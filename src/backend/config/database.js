const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://hvcsabqpstetwqvwrwqu.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('Supabase configuration missing. Database features will be limited.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock database object for compatibility with existing code
const db = {
  // Knex-style query builder mock
  from: (table) => {
    return {
      select: (columns = '*') => ({
        where: (column, value) => supabase.from(table).select(columns).eq(column, value),
        eq: (column, value) => supabase.from(table).select(columns).eq(column, value),
        single: () => supabase.from(table).select(columns).single(),
        first: () => supabase.from(table).select(columns).limit(1).single(),
        orderBy: (column, direction = 'asc') => supabase.from(table).select(columns).order(column, { ascending: direction === 'asc' }),
        limit: (count) => supabase.from(table).select(columns).limit(count),
        offset: (count) => supabase.from(table).select(columns).range(count, count + 1000)
      }),
      insert: (data) => supabase.from(table).insert(data),
      update: (data) => supabase.from(table).update(data),
      delete: () => supabase.from(table).delete(),
      where: (column, value) => ({
        update: (data) => supabase.from(table).update(data).eq(column, value),
        delete: () => supabase.from(table).delete().eq(column, value),
        select: (columns = '*') => supabase.from(table).select(columns).eq(column, value),
        first: () => supabase.from(table).select('*').eq(column, value).limit(1).single()
      }),
      count: (column = '*') => supabase.from(table).select(column, { count: 'exact', head: true })
    };
  },
  
  // Function helpers
  fn: {
    now: () => new Date().toISOString()
  },
  
  // RPC function calls
  rpc: (functionName, params) => supabase.rpc(functionName, params),
  
  // Direct access to Supabase client
  supabase
};

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is ok for testing
      throw error;
    }
    
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    return false;
  }
};

module.exports = {
  db,
  supabase,
  testConnection
};