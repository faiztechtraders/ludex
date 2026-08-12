/**
 * Bridge between the app and the recommendation skill.
 *
 * Components and stores import from `@/engine` — never directly from
 * `skills/`. That keeps the dependency direction one-way and makes the
 * boundary easy to see in a diff.
 */
export * from '@skills/recommendation/index.ts';
