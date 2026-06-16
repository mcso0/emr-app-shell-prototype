"use client";

import { useId, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import { Input } from "./input";

/**
 * Props for the Storybook-only MCP dogfood search recipe.
 */
export type StorybookMcpDogfoodSearchProps = {
  /**
   * Initial synthetic search text used to demonstrate controlled Input composition.
   */
  initialQuery: string;
  /**
   * Visible helper text that keeps the Input accessible without relying on
   * placeholder text as the only label.
   */
  helperText: string;
  /**
   * Disables the recipe controls for visual demonstration only. Permission and
   * security enforcement stay outside Storybook.
   */
  disabled: boolean;
};

/**
 * Storybook-only recipe that composes documented Button, Input, and Badge props.
 *
 * This component exists to dogfood Storybook MCP documentation. Do not use it as
 * a production workflow component.
 *
 * @summary Storybook MCP dogfood search recipe
 */
export function StorybookMcpDogfoodSearch({
  disabled,
  helperText,
  initialQuery,
}: StorybookMcpDogfoodSearchProps) {
  const inputId = useId();
  const helperId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <form
      className="max-w-2xl rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">MCP 문서 확인됨</Badge>
        <Badge variant="outline">Button + Input + Badge</Badge>
      </div>

      <div className="mt-4 grid gap-2">
        <label className="emr-text-label text-foreground" htmlFor={inputId}>
          보호자 또는 환자 검색
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-describedby={helperId}
            disabled={disabled}
            id={inputId}
            onChange={handleQueryChange}
            placeholder="예: 김보호자"
            type="search"
            value={query}
          />
          <Button disabled={disabled} type="submit">
            검색
          </Button>
        </div>
        <p className="emr-text-dense text-muted-foreground" id={helperId}>
          {helperText}
        </p>
      </div>

      <div className="mt-4 rounded-md border border-border bg-muted/35 px-3 py-2">
        <p className="emr-text-dense text-muted-foreground">마지막 검색어</p>
        <p className="emr-text-body font-medium text-foreground">
          검색어: {submittedQuery || "입력 대기"}
        </p>
      </div>
    </form>
  );
}
