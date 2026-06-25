import fs from 'fs';
import path from 'path';

const SCHEMAS_DIR = path.join(import.meta.dirname, '..', 'schemas');
const APPENDIX = fs.readFileSync(
  path.join(SCHEMAS_DIR, '_snippets', 'data-layer-appendix.en.md'),
  'utf8'
);
const BEHAVIOR_APPENDIX = fs.readFileSync(
  path.join(SCHEMAS_DIR, '_snippets', 'behavior-data-layer.en.md'),
  'utf8'
);

const files = fs
  .readdirSync(SCHEMAS_DIR)
  .filter((f) => f.endsWith('-dashboard.md'));

for (const file of files) {
  const filePath = path.join(SCHEMAS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!/[А-Яа-яЁё]/.test(content)) continue;

  if (file === '13-behavior-impact-dashboard.md') {
    content = content.replace(
      /### Единый источник поведенческих событий[\s\S]*?### Route-Based Impact/,
      `### Unified behavior event source
All behavior metrics (idling, aggressive, RPM) now come from a single table processed_common_data.driver_performance_events, filtered by event_type. Direct queries to raw_telematics_data.states/inputs and raw_business_data.sensor_description are no longer used.

### Idling Events
Filter: event_type = 'idle over 5 min' from processed_common_data.driver_performance_events.

### Aggressive Driving
All events from driver_performance_events except idle over 5 min, rpm exceeded, and overspeeding. Includes braking, acceleration, turns, lane changes, and others.

### High Speed`
    );
    content = content.replace(
      /### High RPM\nФильтр:[\s\S]*?### Route-Based Impact/,
      `### High RPM
Filter: event_type = 'rpm exceeded' from processed_common_data.driver_performance_events.

### Week-over-Week
Current 7-day window vs previous 7-day window (total 14 days). Only units where current week count > previous week count are shown, sorted by the largest absolute increase. WoW panels for idling, aggressive, and RPM also use driver_performance_events.

### Route-Based Impact`
    );
    content = content.replace(/\n## Слой данных[\s\S]*/m, BEHAVIOR_APPENDIX);
  } else {
    content = content.replace(/\n## Слой данных[\s\S]*/m, APPENDIX);
  }

  fs.writeFileSync(filePath, content.trimEnd() + '\n');
  console.log('Updated', file);
}

console.log('Done');
