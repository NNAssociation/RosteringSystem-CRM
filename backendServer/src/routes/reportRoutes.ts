import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/tests', (req: Request, res: Response) => {
  const reportPath = path.join(process.cwd(), 'test-report.json');
  if (fs.existsSync(reportPath)) {
    const rawData = fs.readFileSync(reportPath, 'utf8');
    res.json(JSON.parse(rawData));
  } else {
    res.status(404).json({ error: 'Test report not found. Run "npm run test:report" first.' });
  }
});

export default router;
