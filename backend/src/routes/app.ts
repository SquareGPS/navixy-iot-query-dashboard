import { Router } from 'express';
import { DatabaseService } from '../services/database.js';
import { authenticateToken, requireAdmin, requireAdminOrEditor } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { CustomError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ==========================================
// Authentication Routes
// ==========================================

// Login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError('Email and password are required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const result = await dbService.authenticateUser(email, password);

    if (!result) {
      throw new CustomError('Invalid credentials', 401);
    }

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: await dbService.getUserRole(result.user.id)
      },
      token: result.token
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info (verify token)
router.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const dbService = DatabaseService.getInstance();
    const role = await dbService.getUserRole(req.user?.userId || '');

    res.json({
      success: true,
      user: {
        id: req.user?.userId,
        email: req.user?.email,
        role: role
      }
    });
  } catch (error) {
    next(error);
  }
});

// Public registration (for first admin user)
router.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password, role = 'viewer' } = req.body;

    if (!email || !password) {
      throw new CustomError('Email and password are required', 400);
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      throw new CustomError('Invalid role. Must be admin, editor, or viewer', 400);
    }

    const dbService = DatabaseService.getInstance();
    
    // Check if this is the first user (no users exist)
    const existingUsers = await dbService.getUsers();
    
    // If users exist, require admin authentication
    if (existingUsers.length > 0) {
      // This should be handled by the authenticated route
      throw new CustomError('Registration requires admin privileges', 403);
    }

    // Create first admin user
    const user = await dbService.createUser(email, password, 'admin');

    logger.info(`First admin user created: ${email}`);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: 'admin'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      next(new CustomError('User with this email already exists', 409));
    } else {
      next(error);
    }
  }
});

// Admin-only registration (for additional users)
router.post('/auth/register-admin', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { email, password, role = 'viewer' } = req.body;

    if (!email || !password) {
      throw new CustomError('Email and password are required', 400);
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      throw new CustomError('Invalid role. Must be admin, editor, or viewer', 400);
    }

    const dbService = DatabaseService.getInstance();
    const user = await dbService.createUser(email, password, role);

    logger.info(`User created by ${req.user?.email}: ${email} with role ${role}`);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: role
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      next(new CustomError('User with this email already exists', 409));
    } else {
      next(error);
    }
  }
});

// Get current user
router.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// App Settings Routes
// ==========================================

// Get app settings
router.get('/settings', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const dbService = DatabaseService.getInstance();
    const settings = await dbService.getAppSettings();

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
});

// Update app settings (admin only)
router.put('/settings', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.updateAppSettings(req.body);

    logger.info(`App settings updated by ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Test external database connection
router.post('/settings/test-connection', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { external_db_url, external_db_host, external_db_port, external_db_name, external_db_user, external_db_password, external_db_ssl } = req.body;

    const dbService = DatabaseService.getInstance();
    
    const testSettings = {
      external_db_url,
      external_db_host,
      external_db_port,
      external_db_name,
      external_db_user,
      external_db_password,
      external_db_ssl
    };

    // Test the connection without saving settings
    await dbService.testConnectionWithSettings(testSettings);
    
    res.json({
      success: true,
      message: 'Database connection successful'
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Reports and Sections Routes
// ==========================================

// Get all sections
router.get('/sections', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const dbService = DatabaseService.getInstance();
    const sections = await dbService.getSections();

    res.json({
      success: true,
      sections
    });
  } catch (error) {
    next(error);
  }
});

// Get all reports
router.get('/reports', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const dbService = DatabaseService.getInstance();
    const reports = await dbService.getReports();

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    next(error);
  }
});

// Get report by ID
router.get('/reports/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const dbService = DatabaseService.getInstance();
    const report = await dbService.getReportById(id);

    if (!report) {
      throw new CustomError('Report not found', 404);
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
});

// Create section (admin/editor only)
router.post('/sections', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, sort_order, parent_section_id } = req.body;
    
    if (!name) {
      throw new CustomError('Section name is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      const result = await client.query(
        'INSERT INTO public.sections (name, sort_order, created_by) VALUES ($1, $2, $3) RETURNING *',
        [name, sort_order || 0, req.user?.userId]
      );

      logger.info(`Section created by ${req.user?.email}: ${name}`);

      res.status(201).json({
        success: true,
        section: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Update section (admin/editor only)
router.put('/sections/:id', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, sort_index } = req.body;
    
    if (!name) {
      throw new CustomError('Section name is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      const updateFields = ['name = $1'];
      const updateValues = [name];
      let paramIndex = 2;

      if (sort_index !== undefined) {
        updateFields.push(`sort_index = $${paramIndex}`);
        updateValues.push(sort_index);
        paramIndex++;
      }

      const result = await client.query(
        `UPDATE public.sections SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        [...updateValues, id]
      );

      if (result.rows.length === 0) {
        throw new CustomError('Section not found', 404);
      }

      logger.info(`Section updated by ${req.user?.email}: ${name}`);

      res.json({
        success: true,
        section: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Delete section (admin/editor only)
router.delete('/sections/:id', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { moveReportsToSection } = req.query; // Optional: move reports to another section

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      await client.query('BEGIN');

      // First check if section exists
      const checkResult = await client.query(
        'SELECT id, name FROM public.sections WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new CustomError('Section not found', 404);
      }

      const sectionName = checkResult.rows[0].name;

      // Get reports in this section
      const reportsResult = await client.query(
        'SELECT id, title FROM public.reports WHERE section_id = $1',
        [id]
      );

      const reportsInSection = reportsResult.rows;

      if (reportsInSection.length > 0) {
        if (moveReportsToSection) {
          // Move reports to another section
          const targetSectionResult = await client.query(
            'SELECT id FROM public.sections WHERE id = $1',
            [moveReportsToSection]
          );

          if (targetSectionResult.rows.length === 0) {
            throw new CustomError('Target section not found', 404);
          }

          await client.query(
            'UPDATE public.reports SET section_id = $1 WHERE section_id = $2',
            [moveReportsToSection, id]
          );

          logger.info(`Moved ${reportsInSection.length} reports from section "${sectionName}" to section ${moveReportsToSection}`);
        } else {
          // Move reports to root (no section)
          await client.query(
            'UPDATE public.reports SET section_id = NULL WHERE section_id = $1',
            [id]
          );

          logger.info(`Moved ${reportsInSection.length} reports from section "${sectionName}" to root`);
        }
      }

      // Delete the section
      const deleteResult = await client.query(
        'DELETE FROM public.sections WHERE id = $1 RETURNING id',
        [id]
      );

      if (deleteResult.rows.length === 0) {
        throw new CustomError('Failed to delete section', 500);
      }

      await client.query('COMMIT');

      logger.info(`Section deleted by ${req.user?.email}: ${sectionName} (ID: ${id})`);

      res.json({
        success: true,
        message: 'Section deleted successfully',
        movedReports: reportsInSection.length
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Reorder sections (admin/editor only)
router.put('/sections/reorder', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { sections } = req.body; // Array of { id, sort_index }
    
    if (!Array.isArray(sections)) {
      throw new CustomError('Sections array is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      await client.query('BEGIN');

      for (const section of sections) {
        if (!section.id || section.sort_index === undefined) {
          throw new CustomError('Each section must have id and sort_index', 400);
        }

        await client.query(
          'UPDATE public.sections SET sort_index = $1 WHERE id = $2',
          [section.sort_index, section.id]
        );
      }

      await client.query('COMMIT');

      logger.info(`Sections reordered by ${req.user?.email}`);

      res.json({
        success: true,
        message: 'Sections reordered successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Reorder reports (admin/editor only)
router.put('/reports/reorder', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { reports } = req.body; // Array of { id, sort_index, section_id }
    
    if (!Array.isArray(reports)) {
      throw new CustomError('Reports array is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      await client.query('BEGIN');

      for (const report of reports) {
        if (!report.id || report.sort_index === undefined) {
          throw new CustomError('Each report must have id and sort_index', 400);
        }

        const updateFields = ['sort_index = $1'];
        const updateValues = [report.sort_index];
        let paramIndex = 2;

        if (report.section_id !== undefined) {
          updateFields.push(`section_id = $${paramIndex}`);
          updateValues.push(report.section_id);
          paramIndex++;
        }

        await client.query(
          `UPDATE public.reports SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          [...updateValues, report.id]
        );
      }

      await client.query('COMMIT');

      logger.info(`Reports reordered by ${req.user?.email}`);

      res.json({
        success: true,
        message: 'Reports reordered successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Create report (admin/editor only)
router.post('/reports', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { title, section_id, slug, sort_order, report_schema } = req.body;
    
    if (!title || !report_schema) {
      throw new CustomError('Report title and schema are required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO public.reports (title, section_id, slug, sort_order, report_schema, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          title,
          section_id,
          slug || title.toLowerCase().replace(/\s+/g, '-'),
          sort_order || 0,
          JSON.stringify(report_schema),
          req.user?.userId,
          req.user?.userId
        ]
      );

      logger.info(`Report created by ${req.user?.email}: ${title}`);

      res.status(201).json({
        success: true,
        report: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Update report (admin/editor only)
router.put('/reports/:id', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { title, subtitle, report_schema } = req.body;
    
    if (!title) {
      throw new CustomError('Report title is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      const updateFields = ['title = $1', 'updated_by = $2', 'updated_at = NOW()'];
      const updateValues = [title, req.user?.userId];
      let paramIndex = 3;

      if (subtitle !== undefined) {
        updateFields.push(`subtitle = $${paramIndex}`);
        updateValues.push(subtitle);
        paramIndex++;
      }

      if (report_schema) {
        updateFields.push(`report_schema = $${paramIndex}`);
        updateValues.push(JSON.stringify(report_schema));
        paramIndex++;
      }

      const result = await client.query(
        `UPDATE public.reports SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        [...updateValues, id]
      );

      if (result.rows.length === 0) {
        throw new CustomError('Report not found', 404);
      }

      logger.info(`Report updated by ${req.user?.email}: ${title}`);

      res.json({
        success: true,
        report: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Delete report (admin/editor only)
router.delete('/reports/:id', authenticateToken, requireAdminOrEditor, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;

    const dbService = DatabaseService.getInstance();
    const client = await dbService.appPool.connect();
    
    try {
      // First check if report exists
      const checkResult = await client.query(
        'SELECT id, title FROM public.reports WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new CustomError('Report not found', 404);
      }

      const reportTitle = checkResult.rows[0].title;

      // Delete the report
      const deleteResult = await client.query(
        'DELETE FROM public.reports WHERE id = $1 RETURNING id',
        [id]
      );

      if (deleteResult.rows.length === 0) {
        throw new CustomError('Failed to delete report', 500);
      }

      logger.info(`Report deleted by ${req.user?.email}: ${reportTitle} (ID: ${id})`);

      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Get example report schema (public endpoint)
router.get('/schema/example', async (req, res, next) => {
  try {
    const schemaUrl = process.env.REPORT_SCHEMA_URL;
    
    if (!schemaUrl) {
      throw new CustomError('Schema URL not configured', 500);
    }

    const response = await fetch(schemaUrl);
    
    if (!response.ok) {
      throw new CustomError(`Failed to fetch schema: ${response.statusText}`, response.status);
    }

    const schema = await response.json();
    
    logger.info('Example schema fetched successfully');
    
    res.json({
      success: true,
      schema
    });
  } catch (error) {
    next(error);
  }
});

// Get schema configuration (public endpoint)
router.get('/schema/config', async (req, res, next) => {
  try {
    const schemaUrl = process.env.REPORT_SCHEMA_URL;
    
    res.json({
      success: true,
      defaultUrl: schemaUrl || 'https://raw.githubusercontent.com/DanilNezhdanov/grafana-based-dashboard/refs/heads/main/navixy/examples/fleet-status-dashboard.json'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
