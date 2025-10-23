import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sql, page = 1, pageSize = 25, sort } = await req.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate SQL
    const trimmedSql = sql.trim().toUpperCase();
    
    if (!trimmedSql.startsWith('SELECT')) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Only SELECT queries are allowed' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sql.includes(';') && sql.trim().indexOf(';') !== sql.trim().length - 1) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Multiple statements are not allowed' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
    if (dangerousKeywords.some(keyword => trimmedSql.includes(keyword))) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Query contains prohibited keywords' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM (${sql.trim().replace(/;$/, '')}) as count_query`;
    const { data: countData, error: countError } = await supabase.rpc('execute_sql', { query: countSql });

    if (countError) {
      console.error('Count query error:', countError);
      return new Response(
        JSON.stringify({ error: { code: 'EXECUTION_ERROR', message: countError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const total = countData && Array.isArray(countData) && countData.length > 0 
      ? parseInt(countData[0].total) 
      : 0;

    // Apply pagination
    const offset = (page - 1) * pageSize;
    const paginatedSql = `${sql.trim().replace(/;$/, '')} LIMIT ${pageSize} OFFSET ${offset}`;

    const { data, error } = await supabase.rpc('execute_sql', { query: paginatedSql });

    if (error) {
      console.error('SQL execution error:', error);
      return new Response(
        JSON.stringify({ error: { code: 'EXECUTION_ERROR', message: error.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract columns and rows
    const columns = data && Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data || [];

    return new Response(
      JSON.stringify({ columns, rows, total, page, pageSize }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in run-sql-table:', error);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
