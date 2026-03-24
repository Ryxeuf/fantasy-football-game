import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

/**
 * Express middleware that validates req.body against a Zod schema.
 * Returns 400 with { error: "..." } on validation failure.
 */
export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues ?? [];
      const messages = issues.map(
        (e: any) => `${(e.path ?? []).join(".")}: ${e.message}`,
      );
      return res.status(400).json({ error: messages.join(", ") });
    }
    // Replace body with parsed (and coerced) data
    req.body = result.data;
    next();
  };
