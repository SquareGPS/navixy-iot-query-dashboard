# Dashboard Templates Overview

Ниже описаны все шаблоны дашбордов из папки `jsons/add_to_template`.

## 1) Fleet Anomaly Monitor
- **Файл:** `Fleet Anomaly Monitor-schema.json`
- **UID:** `generated-dashboard`
- **Период по умолчанию:** `now-30d -> now`
- **Назначение:** мониторинг аномалий автопарка и проблем с телематикой.
- **Что показывает:** общее число ТС, устройства без GPS-активности 3+ дней, длительные простои и другие индикаторы отклонений.

## 2) Fleet Performance Dashboard
- **Файл:** `Fleet Performance Dashboard-schema (1).json`
- **UID:** `fleet-performance-dashboard`
- **Период по умолчанию:** `now-30d -> now`
- **Назначение:** комплексная оценка эффективности автопарка.
- **Что показывает:** обзор флота (кол-во ТС, пробег), показатели производительности и безопасности, а также блоки по геозонам/операциям.

## 3) Fleet Reports Dashboard
- **Файл:** `Fleet Reports Dashboard-schema (7).json`
- **UID:** `fleet-reports-dashboard`
- **Период по умолчанию:** `now-30d -> now`
- **Назначение:** операционный статус автопарка в реальном времени.
- **Что показывает:** KPI по online/offline объектам, распределение по статусам связи и другие сводные telematics-метрики.

## 4) HM Trip Operations Dashboard
- **Файл:** `HM Trip Operations Dashboard-schema (1).json`
- **UID:** `hm-trip-operations-dashboard`
- **Период по умолчанию:** `now-7d -> now`
- **Назначение:** анализ поездок и сменной активности heavy machinery.
- **Что показывает:** рейсы за вчера по дневному/ночному окну (08:00-19:00 и 19:00-08:00), а также сравнительные операционные показатели за короткий горизонт.

## 5) Heavy Machinery – Actual engine operation
- **Файл:** `Heavy Machinery – Actual engine operation-schema (5).json`
- **UID:** `heavy-machinery-dashboard`
- **Период по умолчанию:** `now-7d -> now`
- **Назначение:** фактическая нагрузка и эксплуатация спецтехники по данным RPM/событий.
- **Что показывает:** часы работы двигателя, посещения зон, метрики загрузки техники и операционные KPI.

## 6) Leasing Dashboard
- **Файл:** `Leasing Dashboard-schema (7).json`
- **UID:** `hello-world`
- **Период по умолчанию:** `now-72h -> now`
- **Назначение:** контроль сроков по лизингу и связанным документам.
- **Что показывает:** водители и ТС с ближайшими датами истечения (в т.ч. просроченные, истекающие в ближайшие 30 дней).

## 7) Object Status Dashboard
- **Файл:** `Object Status Dashboard-schema (19).json`
- **UID:** `hello-world`
- **Период по умолчанию:** `now-72h -> now`
- **Назначение:** детальный статус объектов/устройств по телематике.
- **Что показывает:** online/standby/offline/no signal, moving/stopped/parked, последняя связь и связанные справочники по объектам.

## 8) Trips Dashboard (Yesterday)
- **Файл:** `Trips Dashboard (Yesterday)-schema.json`
- **UID:** `trips-dashboard-yesterday`
- **Период по умолчанию:** `now-1d -> now`
- **Назначение:** сводка поездок за предыдущие сутки.
- **Что показывает:** количество поездок, общий пробег, и дополнительные суточные trip-метрики.

## 9) Vehicle Mileage Dashboard
- **Файл:** `Vehicle Mileage Dashboard-schema (3).json`
- **UID:** `vehicle-mileage`
- **Период по умолчанию:** `now-72h -> now`
- **Назначение:** анализ пробега автопарка.
- **Что показывает:** распределение пробега по категориям времени (рабочее/нерабочее/выходные), недельная структура пробега и связанные KPI.

