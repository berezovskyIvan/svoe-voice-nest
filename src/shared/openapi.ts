import { ApiResponse, type SchemaObject } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

export const lineItem = z.object({
  id: z.int().positive(),
  imageUrl: z.string(),
  name: z.string(),
  price: z.int().positive(),
  qty: z.int().positive(),
  unitLabel: z.string(),
});

const failure = z.object({
  error: z.object({
    code: z.string(),
    details: z
      .object({
        items: z.array(lineItem),
        totalPrice: z.int(),
      })
      .optional(),
    message: z.string(),
  }),
});

export function openApiSchema(schema: ZodType): SchemaObject {
  const { $schema: _schema, ...definition } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
  });
  return definition as SchemaObject;
}

export function ApiMvpError(
  status: number,
  description: string,
): MethodDecorator {
  return ApiResponse({ description, schema: openApiSchema(failure), status });
}
