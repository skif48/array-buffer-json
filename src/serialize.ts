import sizeof from 'object-sizeof';

interface Property {
    valueType: string;
    offset: number;
    byteSize?: number;
    nestedBbo?: BufferBackedObject;
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
            case 'null': {
                return null;
            }
            default: {
                return new Proxy(target.properties[propertyName].nestedBbo!, handler);
            }
        }
    }
};

export function process(object: Record<string, unknown>, buff: ArrayBuffer, view: DataView, bbo: BufferBackedObject, offset = 0): number {
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
            case 'object': {
                if (Array.isArray(value)) {
                    const nestedBbo: BufferBackedObject = {
                        buff,
                        properties: {},
                    };
                    bbo.properties[key] = {
                        valueType: 'array',
                        offset,
                        nestedBbo,
                    };
                    offset += process(value as Record<number, unknown>, buff, view, nestedBbo, offset);
                    break;
                }

                if (value === null) {
                    bbo.properties[key] = {
                        valueType: 'null',
                        offset,
                        byteSize: 0
                    };
                    break;
                }

                const nestedBbo: BufferBackedObject = {
                    buff,
                    properties: {}
                };

                bbo.properties[key] = {
                    valueType: 'object',
                    offset,
                    nestedBbo
                };
                offset += process(value as Record<string, unknown>, buff, view, nestedBbo, offset);
                break;
            }
            default: {
                throw new Error('not implemented');
            }
        }
    }
    return offset;
}

function sizeOf(object: Record<string, unknown>): number {
        const objectList = [];
        const stack: Array<unknown> = [object];
        let bytes = 0;
    
        while (stack.length) {
            var value = stack.pop();
    
            if(typeof value === 'boolean'){
                bytes += 4;
            }else if(typeof value === 'string'){
                
                bytes += (value as string).length * 4;
            }else if(typeof value === 'number'){
                bytes += 8;
            }else if(typeof value === 'object' && objectList.indexOf( value ) === -1){
                objectList.push(value);
                for(var key in value) stack.push((value as Record<string, unknown>)[key]);
            }
        }
        return bytes;
}

export function serialize(object: Record<string, unknown>): Record<string, unknown> {
    const size = sizeOf(object);
    const buff = new ArrayBuffer(size);

    const bbo: BufferBackedObject = {
        buff,
        properties: {},
    };
    const view = new DataView(buff);
    process(object, buff, view, bbo);

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
        nestedObject: {
            key: "value",
            anotherKey: {
                with: "nested value"
            }
        },
        array: [1, 2, { three: "value from an object inside an array with a fucking emoji 🦴" }],
    };
    const bufferedObj = serialize(obj);
    console.log(bufferedObj);
    console.log(bufferedObj.someNumber);
    console.log(bufferedObj.anotherFpNumber);
    console.log(bufferedObj.boolTrue);
    console.log(bufferedObj.boolFalse);
    console.log(bufferedObj.someString);
    console.log(bufferedObj.someUnicodeString);
    console.log(bufferedObj.pureUnicodeEmojisString);
    console.log((bufferedObj.array as Array<number|Record<string, unknown>>)[0]);
    console.log((bufferedObj.array as Array<number|Record<string, unknown>>)[1]);
    console.log(((bufferedObj.array as Array<number|Record<string, unknown>>)[2] as Record<string, unknown>).three);
    console.log((bufferedObj.nestedObject as Record<string, unknown>).key);
    console.log(((bufferedObj.nestedObject as Record<string, unknown>).anotherKey as Record<string, unknown>).with);
}

test();