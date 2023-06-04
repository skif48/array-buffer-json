export function convertToArrayBufferedObject(object: Record<string, unknown>): Record<string, unknown> {
    return new Proxy(object, {});
}