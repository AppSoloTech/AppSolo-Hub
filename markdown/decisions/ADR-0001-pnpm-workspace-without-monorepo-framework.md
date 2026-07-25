---
id: ADR-0001
title: Use pnpm workspaces without a monorepo framework
status: accepted
date: 2026-07-25
approved_by: human
---

# ADR-0001 — Use pnpm Workspaces Without A Monorepo Framework

## Context

The application needs separate web, API, shared-contract, and database packages. The team is small, the initial dependency graph is simple, and the root command surface is known.

## Decision

Use a standard pnpm workspace with root scripts. Do not add Turborepo, Nx, Lage, or another orchestration framework in P001.

## Alternatives Considered

- Turborepo for task caching and pipelines.
- Nx for generators, dependency analysis, and task orchestration.
- Separate repositories for web and API.

## Consequences

- The repository remains easy to inspect and operate.
- Root scripts must explicitly compose package commands.
- Advanced caching is unavailable initially.
- A later framework requires evidence of material build or coordination pain and a new ADR.
