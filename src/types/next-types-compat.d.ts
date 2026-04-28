declare module "next" {
  export type { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
}

declare module "next/types.js" {
  export type {
    ResolvingMetadata,
    ResolvingViewport,
  } from "next/dist/lib/metadata/types/metadata-interface";
}
