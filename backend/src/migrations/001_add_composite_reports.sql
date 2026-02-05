-- Migration: Add composite_reports table
-- Description: Creates the composite_reports table for the Composite Report feature

-- Create composite_reports table
CREATE TABLE IF NOT EXISTS dashboard_studio_meta_data.composite_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL,
    section_id UUID REFERENCES dashboard_studio_meta_data.sections(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    
    -- Core SQL query
    sql_query TEXT NOT NULL,
    
    -- Component configuration (JSONB)
    -- Structure:
    -- {
    --   "table": { "enabled": true, "pageSize": 50, "showTotals": false },
    --   "chart": { "enabled": true, "type": "timeseries", "xColumn": "timestamp", "yColumns": ["value1", "value2"] },
    --   "map": { "enabled": true, "latColumn": "latitude", "lonColumn": "longitude", "autoDetect": true }
    -- }
    config JSONB NOT NULL DEFAULT '{"table": {"enabled": true, "pageSize": 50}, "chart": {"enabled": true, "type": "timeseries"}, "map": {"enabled": false, "autoDetect": true}}',
    
    -- Report schema (Grafana-compatible structure for rendering)
    report_schema JSONB,
    
    -- Standard audit fields
    user_id UUID NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    
    -- Constraints
    CONSTRAINT composite_reports_slug_unique UNIQUE (slug, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_composite_reports_user_id ON dashboard_studio_meta_data.composite_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_composite_reports_section_id ON dashboard_studio_meta_data.composite_reports(section_id);
CREATE INDEX IF NOT EXISTS idx_composite_reports_is_deleted ON dashboard_studio_meta_data.composite_reports(is_deleted);
CREATE INDEX IF NOT EXISTS idx_composite_reports_sort_order ON dashboard_studio_meta_data.composite_reports(sort_order);

-- Add comment for documentation
COMMENT ON TABLE dashboard_studio_meta_data.composite_reports IS 'Stores composite reports that combine SQL query results into Table, Chart, and Map visualizations';
COMMENT ON COLUMN dashboard_studio_meta_data.composite_reports.sql_query IS 'The SQL query that generates data for all components';
COMMENT ON COLUMN dashboard_studio_meta_data.composite_reports.config IS 'Configuration for table, chart, and map components';
COMMENT ON COLUMN dashboard_studio_meta_data.composite_reports.report_schema IS 'Grafana-compatible dashboard schema for rendering';
