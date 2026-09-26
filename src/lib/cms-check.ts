import { z } from 'astro/zod';
import type { Field } from '@sveltia/cms';
import { albumSchema } from './album-schema';
import { albumFields } from './cms';

// The album schema and the CMS fields describe the same data twice. This
// compares them so a field added, removed or changed on one side only fails
// the build instead of producing albums the site can't read.

interface LooseField {
  name: string;
  widget?: string;
  required?: boolean;
  options?: (string | { value: string })[];
  fields?: LooseField[];
}

/** CMS widgets that store each kind of schema value. */
const widgetsFor = (schema: z.ZodType): string[] => {
  if (schema instanceof z.ZodString || schema instanceof z.ZodStringFormat) return ['string', 'text', 'image'];
  if (schema instanceof z.ZodNumber) return ['number'];
  if (schema instanceof z.ZodBoolean) return ['boolean'];
  if (schema instanceof z.ZodDate) return ['datetime'];
  if (schema instanceof z.ZodEnum) return ['select'];
  if (schema instanceof z.ZodObject) return ['object'];
  if (schema instanceof z.ZodArray) return ['list'];
  return [];
};

function unwrap(schema: z.ZodType): { inner: z.ZodType; required: boolean } {
  let inner = schema;
  let required = true;
  while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
    required = false;
    inner = inner.unwrap() as z.ZodType;
  }
  return { inner, required };
}

function compare(shape: Record<string, z.ZodType>, fields: LooseField[], path: string, problems: string[]) {
  const byName = new Map(fields.map((field) => [field.name, field]));
  for (const name of byName.keys()) {
    if (!(name in shape)) problems.push(`${path}${name}: in the CMS but not in the album schema`);
  }
  for (const [name, schema] of Object.entries(shape)) {
    const at = `${path}${name}`;
    const field = byName.get(name);
    if (!field) {
      problems.push(`${at}: in the album schema but not in the CMS`);
      continue;
    }
    const { inner, required } = unwrap(schema);
    const widget = field.widget ?? 'string';
    if (!widgetsFor(inner).includes(widget)) problems.push(`${at}: CMS widget "${widget}" doesn't fit the schema type`);
    if ((field.required ?? true) !== required) {
      problems.push(`${at}: ${required ? 'required' : 'optional'} in the schema but not in the CMS`);
    }
    if (inner instanceof z.ZodEnum) {
      const expected = inner.options.map(String).toSorted().join(', ');
      const actual = (field.options ?? []).map((o) => (typeof o === 'string' ? o : o.value)).toSorted().join(', ');
      if (expected !== actual) problems.push(`${at}: options are [${expected}] in the schema but [${actual}] in the CMS`);
    }
    if (inner instanceof z.ZodObject) compare(inner.shape, field.fields ?? [], `${at}.`, problems);
    if (inner instanceof z.ZodArray) {
      const element = inner.element as z.ZodType;
      if (element instanceof z.ZodObject) compare(element.shape, field.fields ?? [], `${at}[].`, problems);
      else if (field.fields) problems.push(`${at}: a plain list in the schema but has sub-fields in the CMS`);
    }
  }
}

/** Throws with every mismatch between the album schema and the CMS fields. */
export function checkCmsFields(fields: Field[] = albumFields) {
  const problems: string[] = [];
  compare(albumSchema(() => z.string()).shape, fields as LooseField[], '', problems);
  if (problems.length) {
    throw new Error(`The CMS fields in src/lib/cms.ts don't match src/lib/album-schema.ts:\n- ${problems.join('\n- ')}`);
  }
}
