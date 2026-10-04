import { FAMILY_GROUPS } from "@/lib/demo-data";

// Groups that exist from the first start. In this demo they are public, so a
// visitor has something to join; a real deployment would normally leave new
// groups private and invite people instead.
export const SEED_GROUPS: string[] = FAMILY_GROUPS;
export const SEED_GROUPS_PUBLIC = true;
