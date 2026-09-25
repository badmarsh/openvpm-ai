import fs from "node:fs";
import path from "node:path";

/**
 * OpenVPM public API compliance report.
 *
 * This is intentionally dependency-free so the check can run in CI before the
 * application workspace is installed. The source of the rules is the
 * openvpm/api-standards public REST profile; the checks below are the small,
 * auditable subset required by that profile for this API surface.
 *
 * Usage:
 *   pnpm exec tsx scripts/compliance-check.ts
 *   pnpm exec tsx scripts/compliance-check.ts --json
 *   pnpm exec tsx scripts/compliance-check.ts --spec path/to/openapi.yaml
 */

const RULESET = "openvpm/api-standards";
const SPEC_RELATIVE_PATH = "docs/api/openapi.yaml";
const V1_ROUTES_RELATIVE_PATH = "apps/web/app/api/v1";
const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);
const REQUIRED_SCHEMAS = [
  "ErrorResponse",
  "Pagination",
  "Client",
  "Patient",
  "Appointment",
  "SoapNote",
  "ClientListResponse",
  "PatientListResponse",
  "AppointmentListResponse",
  "AppointmentCreate",
  "SoapNoteCreate",
  "AgentRunRequest",
];
const FORBIDDEN_CONTRACT_KEYS = new Set([
  "ketamine",
  "opioid",
  "opioids",
  "propofol",
  "butorphanol",
  "fentanyl",
]);

type JsonObject = Record<string, unknown>;
type CheckStatus = "pass" | "fail";

type Check = {
  id: string;
  status: CheckStatus;
  message: string;
};

type RouteOperation = {
  path: string;
  method: string;
  file: string;
  scope: string | null;
};

type Report = {
  ruleset: string;
  spec: string;
  status: CheckStatus;
  summary: {
    checks: number;
    passed: number;
    failed: number;
    operations: number;
    schemas: number;
  };
  checks: Check[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hasString(value: unknown, expected: string): boolean {
  return asArray(value).some((item) => item === expected);
}

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

function splitInline(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let depth = 0;

  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === "[" || character === "{") depth += 1;
    if (character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim() || value.trim() === "") parts.push(current.trim());
  return parts;
}

function stripYamlComment(value: string): string {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "#" && (index === 0 || /\s/.test(value[index - 1] ?? ""))) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function parseScalar(raw: string): unknown {
  const value = stripYamlComment(raw.trim());
  if (value === "") return "";
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner ? splitInline(inner).map(parseScalar) : [];
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const inner = value.slice(1, -1).trim();
    const result: JsonObject = {};
    for (const part of inner ? splitInline(inner) : []) {
      const separator = part.indexOf(":");
      if (separator < 0) continue;
      result[part.slice(0, separator).trim()] = parseScalar(
        part.slice(separator + 1),
      );
    }
    return result;
  }

  return value;
}

function parseKeyValue(line: string): { key: string; rawValue: string } | null {
  const separator = line.indexOf(":");
  if (separator < 0) return null;
  const rawKey = line.slice(0, separator).trim();
  const parsedKey = parseScalar(rawKey);
  return {
    key: typeof parsedKey === "string" ? parsedKey : rawKey,
    rawValue: line.slice(separator + 1).trim(),
  };
}

/**
 * Small YAML 1.2 reader for the deliberately conservative OpenAPI document
 * in this repository. It supports maps, sequences, quoted scalars, inline
 * arrays/maps, and block strings; it rejects malformed indentation rather than
 * silently producing an inaccurate compliance report.
 */
function parseYaml(source: string): unknown {
  const rawLines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const lines = rawLines
    .map((raw, lineNumber) => ({
      lineNumber: lineNumber + 1,
      indent: indentation(raw),
      text: stripYamlComment(raw.trimEnd()),
    }))
    .filter((line) => line.text.trim() !== "");
  let cursor = 0;

  const parseBlock = (expectedIndent: number): unknown => {
    const first = lines[cursor];
    if (!first || first.indent !== expectedIndent) {
      throw new Error(`Expected YAML indentation ${expectedIndent}.`);
    }
    return first.text.trimStart().startsWith("-")
      ? parseSequence(expectedIndent)
      : parseMap(expectedIndent);
  };

  const parseBlockScalar = (parentIndent: number, folded: boolean): string => {
    const values: string[] = [];
    while (cursor < lines.length && (lines[cursor]?.indent ?? 0) > parentIndent) {
      const line = lines[cursor];
      values.push(line.text.slice(Math.min(line.indent, parentIndent + 2)));
      cursor += 1;
    }
    return folded ? values.join(" ").trim() : values.join("\n").trimEnd();
  };

  const parseMap = (mapIndent: number): JsonObject => {
    const result: JsonObject = {};
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.indent < mapIndent) break;
      if (line.indent > mapIndent) {
        throw new Error(`Unexpected YAML indentation on line ${line.lineNumber}.`);
      }
      if (line.text.trimStart().startsWith("-")) break;
      const pair = parseKeyValue(line.text.trim());
      if (!pair || pair.key === "") {
        throw new Error(`Invalid YAML mapping on line ${line.lineNumber}.`);
      }
      cursor += 1;
      if (pair.rawValue === "|" || pair.rawValue === "|-" || pair.rawValue === ">" || pair.rawValue === ">-") {
        result[pair.key] = parseBlockScalar(mapIndent, pair.rawValue.startsWith(">"));
        continue;
      }
      if (pair.rawValue !== "") {
        result[pair.key] = parseScalar(pair.rawValue);
        continue;
      }
      const next = lines[cursor];
      if (next && next.indent > mapIndent) {
        result[pair.key] = parseBlock(next.indent);
      } else {
        result[pair.key] = {};
      }
    }
    return result;
  };

  const parseSequence = (sequenceIndent: number): unknown[] => {
    const result: unknown[] = [];
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.indent < sequenceIndent) break;
      if (line.indent !== sequenceIndent || !line.text.trimStart().startsWith("-")) break;
      const rest = line.text.trimStart().slice(1).trimStart();
      cursor += 1;
      if (rest === "") {
        const next = lines[cursor];
        result.push(next && next.indent > sequenceIndent ? parseBlock(next.indent) : null);
        continue;
      }

      const pair = parseKeyValue(rest);
      if (!pair) {
        result.push(parseScalar(rest));
        continue;
      }

      const item: JsonObject = {};
      const assignPair = (current: { key: string; rawValue: string }, parentIndent: number) => {
        if (current.rawValue === "|" || current.rawValue === "|-" || current.rawValue === ">" || current.rawValue === ">-") {
          item[current.key] = parseBlockScalar(parentIndent, current.rawValue.startsWith(">"));
        } else if (current.rawValue !== "") {
          item[current.key] = parseScalar(current.rawValue);
        } else {
          const next = lines[cursor];
          item[current.key] = next && next.indent > parentIndent ? parseBlock(next.indent) : {};
        }
      };
      assignPair(pair, sequenceIndent);
      const next = lines[cursor];
      if (next && next.indent > sequenceIndent) {
        const nested = parseBlock(next.indent);
        if (!isObject(nested)) {
          throw new Error(`Sequence item on line ${line.lineNumber} must contain a mapping.`);
        }
        Object.assign(item, nested);
      }
      result.push(item);
    }
    return result;
  };

  if (lines.length === 0) return {};
  return parseBlock(lines[0].indent);
}

function pointerValue(document: unknown, pointer: string): unknown {
  if (!pointer.startsWith("#/")) return undefined;
  return pointer
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((current, segment) => {
      if (!isObject(current)) return undefined;
      return current[segment];
    }, document);
}

function resolveRef(document: unknown, value: unknown): unknown {
  let current = value;
  const seen = new Set<string>();
  while (isObject(current) && typeof current.$ref === "string") {
    const reference = current.$ref;
    if (seen.has(reference)) return undefined;
    seen.add(reference);
    current = pointerValue(document, reference);
  }
  return current;
}

function recursivelyFindRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) recursivelyFindRefs(item, refs);
  } else if (isObject(value)) {
    if (typeof value.$ref === "string") refs.push(value.$ref);
    for (const child of Object.values(value)) recursivelyFindRefs(child, refs);
  }
  return refs;
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function routePathFromDirectory(v1Root: string, routeDirectory: string): string {
  const relative = path.relative(v1Root, routeDirectory);
  const segments = relative ? relative.split(path.sep) : [];
  const normalized = segments
    .filter((segment) => !/^\([^)]*\)$/.test(segment))
    .map((segment) => {
      if (segment.startsWith("[...") && segment.endsWith("]")) return `{${segment.slice(4, -1)}}`;
      if (segment.startsWith("[") && segment.endsWith("]")) return `{${segment.slice(1, -1)}}`;
      return segment;
    });
  return `/api/v1${normalized.length ? `/${normalized.join("/")}` : ""}`;
}

function discoverRouteOperations(repoRoot: string): RouteOperation[] {
  const routesRoot = path.join(repoRoot, V1_ROUTES_RELATIVE_PATH);
  const operations: RouteOperation[] = [];
  const methodPattern = /export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\b/g;

  for (const file of walkFiles(routesRoot).filter((candidate) => path.basename(candidate) === "route.ts")) {
    const source = fs.readFileSync(file, "utf8");
    const matches = [...source.matchAll(methodPattern)];
    for (const [index, match] of matches.entries()) {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? source.length;
      const handler = source.slice(start, end);
      const scope = /authenticateApiKey\s*\(\s*req\s*,\s*["']([^"']+)["']\s*\)/.exec(handler)?.[1] ?? null;
      operations.push({
        path: routePathFromDirectory(routesRoot, path.dirname(file)),
        method: match[1].toLowerCase(),
        file: path.relative(repoRoot, file),
        scope,
      });
    }
  }
  return operations.sort((left, right) => `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`));
}

function operationKey(pathName: string, method: string): string {
  return `${method.toLowerCase()} ${pathName}`;
}

function getParameterName(parameter: unknown, document: unknown): string | null {
  const resolved = resolveRef(document, parameter);
  return isObject(resolved) && typeof resolved.name === "string" ? resolved.name : null;
}

function requiredParameterNames(operation: JsonObject, document: unknown): Set<string> {
  const names = new Set<string>();
  for (const parameter of asArray(operation.parameters)) {
    const resolved = resolveRef(document, parameter);
    if (isObject(resolved) && resolved.required === true && typeof resolved.name === "string") {
      names.add(resolved.name);
    }
  }
  return names;
}

function responseHasJsonSchema(response: unknown, document: unknown): boolean {
  const resolved = resolveRef(document, response);
  if (!isObject(resolved)) return false;
  const content = asObject(resolved.content);
  const json = asObject(content["application/json"]);
  return resolveRef(document, json.schema) !== undefined;
}

function responseHasErrorSchema(response: unknown, document: unknown): boolean {
  const resolved = resolveRef(document, response);
  if (!isObject(resolved)) return false;
  const content = asObject(resolved.content);
  const json = asObject(content["application/json"]);
  const schema = resolveRef(document, json.schema);
  if (!isObject(schema)) return false;
  return hasString(schema.required, "error") || schema === asObject(pointerValue(document, "#/components/schemas/ErrorResponse"));
}

function collectContractKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectContractKeys(item, keys);
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key.toLowerCase());
      collectContractKeys(child, keys);
    }
  }
  return keys;
}

function check(report: Check[], id: string, passed: boolean, message: string): void {
  report.push({ id, status: passed ? "pass" : "fail", message });
}

function buildReport(repoRoot: string, specPath: string, scanRoutes: boolean): Report {
  const checks: Check[] = [];
  let document: unknown = {};
  let sourceOperations: RouteOperation[] = [];

  if (!fs.existsSync(specPath)) {
    check(checks, "OA-000", false, `OpenAPI document not found: ${path.relative(repoRoot, specPath)}`);
  } else {
    try {
      document = parseYaml(fs.readFileSync(specPath, "utf8"));
      check(checks, "OA-000", true, "OpenAPI document was parsed as YAML.");
    } catch (error) {
      check(checks, "OA-000", false, `OpenAPI document is invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const root = asObject(document);
  const info = asObject(root.info);
  const paths = asObject(root.paths);
  const components = asObject(root.components);
  const schemas = asObject(components.schemas);
  const securitySchemes = asObject(components.securitySchemes);

  check(checks, "OA-001", root.openapi === "3.1.0", "Document declares OpenAPI 3.1.0.");
  check(checks, "OA-002", typeof info.title === "string" && typeof info.version === "string", "Info title and version are present.");
  check(checks, "OA-003", typeof root.jsonSchemaDialect === "string" && root.jsonSchemaDialect.includes("2020-12"), "The JSON Schema 2020-12 dialect is declared.");
  check(checks, "OA-004", Array.isArray(root.servers) && root.servers.length > 0, "At least one deployment server is documented.");
  check(checks, "OA-005", isObject(root["x-compliance"]) && asObject(root["x-compliance"]).ruleset === RULESET, `Compliance metadata names ${RULESET}.`);
  check(checks, "SEC-001", isObject(securitySchemes.bearerAuth) && isObject(securitySchemes.apiKeyHeader), "Bearer and X-API-Key security schemes are defined.");

  const references = recursivelyFindRefs(document);
  const unresolvedReferences = references.filter((reference) => pointerValue(document, reference) === undefined);
  check(checks, "OA-006", unresolvedReferences.length === 0, unresolvedReferences.length ? `Unresolved references: ${unresolvedReferences.join(", ")}` : "All local references resolve.");

  if (scanRoutes) {
    sourceOperations = discoverRouteOperations(repoRoot);
    check(checks, "SURFACE-001", sourceOperations.length > 0, `Discovered ${sourceOperations.length} exported v1 route operation(s).`);
  }

  const specOperations: Array<{ path: string; method: string; operation: JsonObject }> = [];
  for (const [pathName, pathItemValue] of Object.entries(paths)) {
    const pathItem = asObject(pathItemValue);
    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      specOperations.push({ path: pathName, method: method.toLowerCase(), operation: asObject(operationValue) });
    }
  }

  const duplicateOperationIds = new Set<string>();
  const operationIds = new Set<string>();
  for (const { path: pathName, method, operation } of specOperations) {
    const operationId = asString(operation.operationId);
    if (operationId && operationIds.has(operationId)) duplicateOperationIds.add(operationId);
    if (operationId) operationIds.add(operationId);

    check(checks, `DOC-${method.toUpperCase()}-${pathName}-001`, Boolean(operationId), `${method.toUpperCase()} ${pathName} has an operationId.`);
    check(checks, `DOC-${method.toUpperCase()}-${pathName}-002`, Boolean(asString(operation.summary) && asString(operation.description)), `${method.toUpperCase()} ${pathName} has summary and description text.`);
    check(checks, `SEC-${method.toUpperCase()}-${pathName}-001`, asArray(operation.security).length > 0, `${method.toUpperCase()} ${pathName} declares authentication.`);
    check(checks, `SEC-${method.toUpperCase()}-${pathName}-002`, typeof operation["x-required-scope"] === "string", `${method.toUpperCase()} ${pathName} declares its required API scope.`);

    const parameters = asArray(operation.parameters);
    const parameterNames = new Set(parameters.map((parameter) => getParameterName(parameter, document)).filter((name): name is string => Boolean(name)));
    const pathParameterNames = [...pathName.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    for (const parameterName of pathParameterNames) {
      const resolvedParameter = parameters.map((parameter) => resolveRef(document, parameter)).find((parameter) => isObject(parameter) && parameter.name === parameterName);
      check(checks, `PARAM-${method.toUpperCase()}-${pathName}-${parameterName}`, isObject(resolvedParameter) && resolvedParameter.in === "path" && resolvedParameter.required === true, `${method.toUpperCase()} ${pathName} declares required path parameter ${parameterName}.`);
    }

    if (method === "get" && pathParameterNames.length === 0) {
      check(checks, `PAG-${pathName}-001`, parameterNames.has("limit") && parameterNames.has("offset"), `GET ${pathName} declares limit and offset pagination parameters.`);
    }

    if (method === "post") {
      const requestBody = resolveRef(document, operation.requestBody);
      const content = isObject(requestBody) ? asObject(requestBody.content) : {};
      const json = asObject(content["application/json"]);
      check(checks, `REQ-${pathName}-001`, isObject(requestBody) && requestBody.required === true && resolveRef(document, json.schema) !== undefined, `POST ${pathName} has a required JSON request schema.`);
    }

    const responses = asObject(operation.responses);
    check(checks, `RES-${method.toUpperCase()}-${pathName}-001`, Object.keys(responses).length > 0, `${method.toUpperCase()} ${pathName} declares responses.`);
    for (const [status, response] of Object.entries(responses)) {
      const numericStatus = Number(status);
      const hasSchema = responseHasJsonSchema(response, document);
      check(checks, `RES-${method.toUpperCase()}-${pathName}-${status}`, hasSchema, `${method.toUpperCase()} ${pathName} ${status} has an application/json schema.`);
      if (numericStatus >= 400) {
        check(checks, `ERR-${method.toUpperCase()}-${pathName}-${status}`, responseHasErrorSchema(response, document), `${method.toUpperCase()} ${pathName} ${status} uses the standard error envelope.`);
      }
    }
    for (const requiredStatus of ["401", "403", "429"]) {
      check(checks, `SEC-${method.toUpperCase()}-${pathName}-${requiredStatus}`, Object.prototype.hasOwnProperty.call(responses, requiredStatus), `${method.toUpperCase()} ${pathName} documents HTTP ${requiredStatus}.`);
    }
  }

  check(checks, "DOC-001", duplicateOperationIds.size === 0, duplicateOperationIds.size ? `Duplicate operationId values: ${[...duplicateOperationIds].join(", ")}` : "Operation IDs are unique.");
  check(checks, "SCHEMA-001", REQUIRED_SCHEMAS.every((name) => Object.prototype.hasOwnProperty.call(schemas, name)), "The public resource, request, list, and error schemas are present.");
  check(checks, "SCHEMA-002", Object.values(schemas).every((schema) => !isObject(schema) || schema.type !== "object" || schema.additionalProperties !== undefined), "Object schemas state their additional-property policy.");

  const soapRequest = asObject(resolveRef(document, schemas.SoapNoteCreate));
  const soapProperties = asObject(soapRequest.properties);
  check(checks, "CLIN-001", soapRequest.required instanceof Array && hasString(soapRequest.required, "clinician_confirmed"), "SOAP creation requires clinician_confirmed.");
  check(checks, "CLIN-002", soapProperties.clinician_confirmed !== undefined && asObject(soapProperties.clinician_confirmed).const === true, "SOAP clinician_confirmed is constrained to true.");
  check(checks, "CLIN-003", typeof asObject(soapProperties.clinician_confirmed).description === "string" && asObject(soapProperties.clinician_confirmed).description.toLowerCase().includes("clinician"), "SOAP confirmation explains the human review gate.");

  const agentRequest = asObject(resolveRef(document, schemas.AgentRunRequest));
  const agentProperties = asObject(agentRequest.properties);
  check(checks, "CLIN-004", asObject(agentProperties.allow_writes).default === false, "Agent writes default to disabled.");

  const patientSchema = asObject(resolveRef(document, schemas.Patient));
  const patientStatus = asObject(asObject(patientSchema.properties).status);
  check(checks, "SAFE-001", hasString(patientStatus.enum, "deceased"), "Patient status preserves the deceased state.");
  check(checks, "SAFE-002", Object.keys(paths).every((pathName) => !/(?:remind|outreach|review)/i.test(pathName)), "No automated reminder, outreach, or review path is exposed.");

  const contractKeys = collectContractKeys(document);
  const forbiddenKeys = [...FORBIDDEN_CONTRACT_KEYS].filter((key) => contractKeys.has(key));
  check(checks, "SAFE-003", forbiddenKeys.length === 0, forbiddenKeys.length ? `Forbidden controlled-substance fields found: ${forbiddenKeys.join(", ")}` : "No controlled-substance prefill fields are exposed.");

  if (scanRoutes) {
    const sourceKeys = new Set(sourceOperations.map((operation) => operationKey(operation.path, operation.method)));
    const specKeys = new Set(specOperations.map((operation) => operationKey(operation.path, operation.method)));
    const missingInSpec = [...sourceKeys].filter((key) => !specKeys.has(key));
    const staleInSpec = [...specKeys].filter((key) => !sourceKeys.has(key));
    check(checks, "SURFACE-002", missingInSpec.length === 0 && staleInSpec.length === 0, missingInSpec.length || staleInSpec.length ? `Surface mismatch. Missing: ${missingInSpec.join(", ") || "none"}; stale: ${staleInSpec.join(", ") || "none"}.` : "OpenAPI operations match every exported v1 route operation.");

    for (const sourceOperation of sourceOperations) {
      const specOperation = specOperations.find((candidate) => operationKey(candidate.path, candidate.method) === operationKey(sourceOperation.path, sourceOperation.method));
      const declaredScope = specOperation?.operation["x-required-scope"];
      check(checks, `SURFACE-SCOPE-${sourceOperation.method.toUpperCase()}-${sourceOperation.path}`, Boolean(sourceOperation.scope && declaredScope === sourceOperation.scope), `${sourceOperation.method.toUpperCase()} ${sourceOperation.path} scope matches ${sourceOperation.file}.`);
    }
  }

  const passed = checks.filter((item) => item.status === "pass").length;
  const failed = checks.length - passed;
  return {
    ruleset: RULESET,
    spec: path.relative(repoRoot, specPath),
    status: failed === 0 ? "pass" : "fail",
    summary: {
      checks: checks.length,
      passed,
      failed,
      operations: specOperations.length,
      schemas: Object.keys(schemas).length,
    },
    checks,
  };
}

function printReport(report: Report, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write("OpenVPM OpenAPI compliance report\n");
  process.stdout.write(`Ruleset: ${report.ruleset}\n`);
  process.stdout.write(`Spec: ${report.spec}\n`);
  process.stdout.write(`Status: ${report.status.toUpperCase()}\n`);
  process.stdout.write(`Checks: ${report.summary.passed}/${report.summary.checks} passed; operations=${report.summary.operations}; schemas=${report.summary.schemas}\n\n`);
  for (const item of report.checks) {
    process.stdout.write(`${item.status === "pass" ? "PASS" : "FAIL"} ${item.id} ${item.message}\n`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write("Usage: tsx scripts/compliance-check.ts [--json] [--spec path] [--skip-route-scan]\n");
    return;
  }

  const json = args.includes("--json");
  const scanRoutes = !args.includes("--skip-route-scan");
  const specArgumentIndex = args.indexOf("--spec");
  const specArgument = specArgumentIndex >= 0 ? args[specArgumentIndex + 1] : undefined;
  if (specArgumentIndex >= 0 && !specArgument) {
    process.stderr.write("--spec requires a file path.\n");
    process.exitCode = 2;
    return;
  }

  const cwdRoot = process.cwd();
  const scriptRoot = process.argv[1]
    ? path.resolve(path.dirname(path.resolve(process.argv[1])), "..")
    : cwdRoot;
  const repoRoot = fs.existsSync(path.join(cwdRoot, SPEC_RELATIVE_PATH))
    ? cwdRoot
    : scriptRoot;
  const specPath = path.resolve(repoRoot, specArgument ?? SPEC_RELATIVE_PATH);
  const report = buildReport(repoRoot, specPath, scanRoutes);
  printReport(report, json);
  if (report.status === "fail") process.exitCode = 1;
}

main();
