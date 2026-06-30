import { Router } from 'express';
import { DatabaseService } from '../services/database.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { CustomError } from '../middleware/errorHandler.js';

const router = Router();

// Get the drag-n-drop chart preset catalog (FR-11365).
// Read-only: a single analyst-maintained row in
// dashboard_studio_meta_data.chart_preset_catalog (one row per client DB).
router.get('/chart-catalog', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.settingsPool) {
      throw new CustomError('Settings pool not available', 500);
    }

    const dbService = DatabaseService.getInstance();
    const catalog = await dbService.getChartPresetCatalog(req.settingsPool);

    res.json({
      success: true,
      // Empty catalog (not an error) when the table/row is missing — the dock renders empty.
      catalog: catalog ?? { schemaVersion: '1.0', groups: [] },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
