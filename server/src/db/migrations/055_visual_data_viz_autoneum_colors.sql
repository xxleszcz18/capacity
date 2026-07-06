-- Domyślna kolorystyka wizualizacji danych — paleta korporacyjna Autoneum
UPDATE admin_settings SET value = '#8A9300' WHERE key = 'visual_data_viz_color_production';
UPDATE admin_settings SET value = '#E86A10' WHERE key = 'visual_data_viz_color_contract';
UPDATE admin_settings SET value = '#008BC1' WHERE key = 'visual_data_viz_color_scenario_production';
UPDATE admin_settings SET value = '#F59B47' WHERE key = 'visual_data_viz_color_scenario_contract';
UPDATE admin_settings SET value = '#E86A10' WHERE key = 'visual_data_viz_color_delta_negative';
UPDATE admin_settings SET value = '#8A9300' WHERE key = 'visual_data_viz_color_delta_positive';
UPDATE admin_settings SET value = '#E86A10' WHERE key = 'visual_data_viz_color_ref_line_overload';
UPDATE admin_settings SET value = '#8A9300' WHERE key = 'visual_data_viz_color_ref_line_free';
UPDATE admin_settings SET value = '["#8A9300","#008BC1","#E86A10","#B8C400","#00B0E8","#F59B47","#7A7B7A","#66B9DA","#B9BE66","#F1A670"]' WHERE key = 'visual_data_viz_compare_palette';
