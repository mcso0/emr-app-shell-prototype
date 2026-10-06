// Preserve Storybook's router mocks and the readonly params export used by panels.
export * from "@storybook/nextjs-vite/navigation.mock";
export { ReadonlyURLSearchParams } from "next/dist/client/components/navigation.react-server";
