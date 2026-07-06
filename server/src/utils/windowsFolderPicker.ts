import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PICK_TIMEOUT_MS = 10 * 60 * 1000;

/** BIF_RETURNONLYFSDIRS | BIF_EDITBOX | BIF_NEWDIALOGSTYLE */
const SHELL_BROWSE_FLAGS = 0x51;

function escapeForPsSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function writeUtf8BomFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, `\uFEFF${content}`, 'utf8');
}

function cleanupFiles(...files: string[]): void {
  for (const file of files) {
    try {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function waitForProcessExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code);
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      finish(null);
    }, timeoutMs);
    child.on('error', () => finish(null));
    child.on('exit', (code) => finish(code));
  });
}

function readPickedPath(outFile: string): { chosen: boolean; path: string } {
  if (!fs.existsSync(outFile)) return { chosen: false, path: '' };
  const picked = fs.readFileSync(outFile, 'utf8').trim();
  return picked ? { chosen: true, path: picked } : { chosen: false, path: '' };
}

/** Bez windowsHide — CREATE_NO_WINDOW blokuje okna dialogowe uruchamiane z procesu potomnego. */
async function runPowerShellScriptFile(scriptPath: string, outFile: string) {
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      detached: false,
      stdio: 'ignore',
      windowsHide: false,
    },
  );
  const exitCode = await waitForProcessExit(child, PICK_TIMEOUT_MS);
  if (exitCode === null) {
    return { chosen: false, path: '', error: 'TIMEOUT' };
  }
  return readPickedPath(outFile);
}

function buildFolderPickerPs1(description: string, outFile: string): string {
  const safeDesc = escapeForPsSingleQuoted(description);
  const safeOut = escapeForPsSingleQuoted(outFile);
  return `$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CapPickerNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
"@
$hwnd = [CapPickerNative]::GetForegroundWindow().ToInt32()
$shell = New-Object -ComObject Shell.Application
$folder = $shell.BrowseForFolder($hwnd, '${safeDesc}', ${SHELL_BROWSE_FLAGS}, 0)
if ($folder) {
  $picked = [string]$folder.Self.Path
  if ($picked) {
    [IO.File]::WriteAllText('${safeOut}', $picked, [Text.UTF8Encoding]::new($false))
  }
}
`;
}

function buildFilePickerPs1(description: string, initialDir: string, outFile: string): string {
  const safeDesc = escapeForPsSingleQuoted(description);
  const safeDir = escapeForPsSingleQuoted(initialDir || os.homedir());
  const safeOut = escapeForPsSingleQuoted(outFile);
  return `$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public class CapPickerNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
public class CapPickerOwner : IWin32Window {
  public CapPickerOwner(IntPtr handle) { Handle = handle; }
  public IntPtr Handle { get; private set; }
}
"@
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles() | Out-Null
$owner = New-Object CapPickerOwner([CapPickerNative]::GetForegroundWindow())
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = '${safeDesc}'
$dlg.Filter = 'Pliki bazy (*.db)|*.db|Wszystkie pliki (*.*)|*.*'
$dlg.InitialDirectory = '${safeDir}'
if ($dlg.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [IO.File]::WriteAllText('${safeOut}', $dlg.FileName, [Text.UTF8Encoding]::new($false))
}
`;
}

/** Otwiera natywne okno wyboru folderu z polem ścieżki, na aktywnym ekranie. */
export async function pickWindowsFolder(description: string): Promise<{ chosen: boolean; path: string; error?: string }> {
  if (process.platform !== 'win32') {
    return { chosen: false, path: '', error: 'NOT_WINDOWS' };
  }

  const outFile = path.join(os.tmpdir(), `cap-folder-pick-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  const psFile = path.join(os.tmpdir(), `cap-folder-pick-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);

  try {
    writeUtf8BomFile(psFile, buildFolderPickerPs1(description, outFile));
    return await runPowerShellScriptFile(psFile, outFile);
  } catch (e: any) {
    return { chosen: false, path: '', error: e?.message || 'PICK_FAILED' };
  } finally {
    cleanupFiles(outFile, psFile);
  }
}

/** Otwiera natywne okno wyboru pliku .db na aktywnym ekranie. */
export async function pickWindowsDbFile(description: string, initialDir: string): Promise<{ chosen: boolean; path: string; error?: string }> {
  if (process.platform !== 'win32') {
    return { chosen: false, path: '', error: 'NOT_WINDOWS' };
  }

  const outFile = path.join(os.tmpdir(), `cap-file-pick-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  const psFile = path.join(os.tmpdir(), `cap-file-pick-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);

  try {
    writeUtf8BomFile(psFile, buildFilePickerPs1(description, initialDir, outFile));
    return await runPowerShellScriptFile(psFile, outFile);
  } catch (e: any) {
    return { chosen: false, path: '', error: e?.message || 'PICK_FAILED' };
  } finally {
    cleanupFiles(outFile, psFile);
  }
}
