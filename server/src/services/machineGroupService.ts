import { db } from '../db/connection.js';

export type MachineGroupRow = {
  id: number;
  name: string;
  created_at: string;
};

export type MachineGroupMachine = {
  id: number;
  internal_number: string | null;
  sap_number: string | null;
  type: string;
};

export function listMachineGroups(): (MachineGroupRow & { machines: MachineGroupMachine[] })[] {
  const groups = db.prepare('SELECT id, name, created_at FROM machine_groups ORDER BY name COLLATE NOCASE, id').all() as MachineGroupRow[];
  const machinesStmt = db.prepare(`
    SELECT m.id, m.internal_number, m.sap_number, m.type
    FROM machine_group_members mgm
    JOIN machines m ON m.id = mgm.machine_id
    WHERE mgm.group_id = ?
    ORDER BY m.internal_number COLLATE NOCASE, m.id
  `);
  return groups.map((g) => ({
    ...g,
    machines: machinesStmt.all(g.id) as MachineGroupMachine[],
  }));
}

export function getMachineGroup(id: number): (MachineGroupRow & { machines: MachineGroupMachine[] }) | null {
  const group = db.prepare('SELECT id, name, created_at FROM machine_groups WHERE id = ?').get(id) as MachineGroupRow | undefined;
  if (!group) return null;
  const machines = db.prepare(`
    SELECT m.id, m.internal_number, m.sap_number, m.type
    FROM machine_group_members mgm
    JOIN machines m ON m.id = mgm.machine_id
    WHERE mgm.group_id = ?
    ORDER BY m.internal_number COLLATE NOCASE, m.id
  `).all(id) as MachineGroupMachine[];
  return { ...group, machines };
}

export function createMachineGroup(name: string, machineIds: number[] = []): MachineGroupRow & { machines: MachineGroupMachine[] } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nazwa grupy jest wymagana.');
  const r = db.prepare('INSERT INTO machine_groups (name) VALUES (?)').run(trimmed);
  const id = Number(r.lastInsertRowid);
  setMachineGroupMembers(id, machineIds);
  return getMachineGroup(id)!;
}

export function updateMachineGroup(id: number, name: string, machineIds?: number[]): MachineGroupRow & { machines: MachineGroupMachine[] } {
  const existing = db.prepare('SELECT id FROM machine_groups WHERE id = ?').get(id);
  if (!existing) throw new Error('Not found');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nazwa grupy jest wymagana.');
  db.prepare('UPDATE machine_groups SET name = ? WHERE id = ?').run(trimmed, id);
  if (machineIds != null) setMachineGroupMembers(id, machineIds);
  return getMachineGroup(id)!;
}

export function deleteMachineGroup(id: number): boolean {
  const r = db.prepare('DELETE FROM machine_groups WHERE id = ?').run(id);
  return r.changes > 0;
}

export function setMachineGroupMembers(groupId: number, machineIds: number[]): void {
  const unique = [...new Set(machineIds.filter((id) => Number.isFinite(id) && id > 0))];
  db.prepare('DELETE FROM machine_group_members WHERE group_id = ?').run(groupId);
  const insert = db.prepare('INSERT INTO machine_group_members (group_id, machine_id) VALUES (?, ?)');
  for (const machineId of unique) {
    const machine = db.prepare('SELECT id FROM machines WHERE id = ?').get(machineId);
    if (machine) insert.run(groupId, machineId);
  }
}

export function parseGroupIdsParam(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[,;]+/).map((s) => Number(s.trim())).filter((id) => Number.isFinite(id) && id > 0))];
}

export function resolveMachineIdsFromGroups(groupIds: number[]): number[] {
  if (!groupIds.length) return [];
  const placeholders = groupIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT DISTINCT machine_id AS id FROM machine_group_members WHERE group_id IN (${placeholders})`)
    .all(...groupIds) as { id: number }[];
  return rows.map((r) => Number(r.id));
}
