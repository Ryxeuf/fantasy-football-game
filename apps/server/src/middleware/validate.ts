import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

function formatZodErrors(error: { issues?: any[] }): string {
  const issues = error.issues ?? [];
  const messages = issues.map(
    (e: any) => `${(e.path ?? []).join(".")}: ${e.message}`,
  );
  return messages.join(", ");
}

/**
 * Express middleware that validates req.body against a Zod schema.
 * Returns 400 with { error: "..." } on validation failure.
 */
export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: formatZodErrors(result.error) });
    }
    // Replace body with parsed (and coerced) data
    req.body = result.data;
    next();
  };

/**
 * Express middleware that validates req.query against a Zod schema.
 * Returns 400 with { error: "..." } on validation failure.
 */
export const validateQuery =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: formatZodErrors(result.error) });
    }
    // Replace query with parsed (and coerced) data
    (req as any).query = result.data;
    next();
  };
