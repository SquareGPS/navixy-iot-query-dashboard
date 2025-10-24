-- Update the Fleet Status report table to use a simpler query
UPDATE report_tables 
SET sql = 'SELECT * 
FROM raw_telematics_data.tracking_data_core 
LIMIT 10',
    updated_at = now()
WHERE id = 'b56ec690-cdb6-43d2-b117-3622dc4a307a';