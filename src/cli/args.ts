export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = toCamelCase(token.slice(2));
    const nextToken = argv[index + 1];
    if (nextToken === undefined || nextToken.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = nextToken;
    index += 1;
  }

  return args;
}

function toCamelCase(value: string): string {
  const [firstPart = "", ...remainingParts] = value.split("-");
  return `${firstPart}${remainingParts.map(capitalize).join("")}`;
}

function capitalize(value: string): string {
  return value.length === 0 ? "" : `${value[0].toUpperCase()}${value.slice(1)}`;
}
