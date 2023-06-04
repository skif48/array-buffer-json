import sizeof from 'object-sizeof';

interface Property {
    valueType: string;
    offset: number;
    byteSize: number;
}

interface BufferBackedObject {
    buff: ArrayBuffer;
    properties: Record<string, Property>;
    [x: string]: unknown;
}

const handler = {
    get(target: BufferBackedObject, propertyName: string): unknown {
        const property = target.properties[propertyName];
        if (!property) {
            return undefined;
        }

        const view = new DataView(target.buff);
        
        const { offset, valueType } = property;

        switch (valueType) {
            case 'number': {
                return view.getFloat64(offset);
            }
            case 'boolean': {
                return view.getUint8(offset) === 1;
            }
            case 'string': {
                const temp = new Uint8Array(target.buff, offset, property.byteSize);
                return new TextDecoder().decode(temp);
            }
            default: {
                throw new Error('not implemented');
            }
        }
    }
};

export function serialize(object: Record<string, unknown>): Record<string, unknown> {
    const size = sizeof(object);
    const buff = new ArrayBuffer(size);

    const bbo: BufferBackedObject = {
        buff,
        properties: {},
    };
    const view = new DataView(buff);
    let offset = 0;
    for (const [key, value] of Object.entries(object)) {
        const valueType = typeof value;
        switch (valueType) {
            case 'number': {
                view.setFloat64(offset, value as number);
                bbo.properties[key] = {
                    valueType,
                    offset,
                    byteSize: Float64Array.BYTES_PER_ELEMENT,
                };
                offset += Float64Array.BYTES_PER_ELEMENT;
                break;
            }
            case 'boolean': {
                if (value) {
                    view.setUint8(offset, 1);
                } else {
                    view.setUint8(offset, 0);
                }
                bbo.properties[key] = {
                    valueType,
                    offset,
                    byteSize: Uint8Array.BYTES_PER_ELEMENT,
                };
                offset += Uint8Array.BYTES_PER_ELEMENT;
                break;
            }
            case 'string': {
                const uint8Arr = new TextEncoder().encode(value as string);
                bbo.properties[key] = {
                    valueType,
                    offset,
                    byteSize: uint8Arr.length,
                };
                for (const charCode of uint8Arr) {
                    view.setUint8(offset, charCode);
                    offset += uint8Arr.BYTES_PER_ELEMENT;
                }
                break;
            }
            default: {
                throw new Error('not implemented');
            }
        }
    }

    return new Proxy(bbo, handler);
}


function test() {
    const obj = {
        someNumber: 123,
        anotherFpNumber: 123.45,
        boolTrue: true,
        boolFalse: false,
        someString: "hello world",
        someUnicodeString: "привіт друже як справи?",
        pureUnicodeEmojisString: "🦴🙍☹😔🤬😡",
    };
    const bufferedObj = serialize(obj);
    console.log(bufferedObj.someNumber);
    console.log(bufferedObj.anotherFpNumber);
    console.log(bufferedObj.boolTrue);
    console.log(bufferedObj.boolFalse);
    console.log(bufferedObj.someString);
    console.log(bufferedObj.someUnicodeString);
    console.log(bufferedObj.pureUnicodeEmojisString);
}

test();