/**
 * Compile-time parity contract for handwritten domain interfaces and their runtime decoder shapes.
 */
import type { input, output, ZodType } from "zod";

type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type ContainsAny<T> =
  IsAny<T> extends true ? true
    : IsNever<T> extends true ? false
      : T extends readonly (infer Item)[] ? ContainsAny<Item>
        : T extends object
          ? true extends {
            [Key in keyof T]-?: ContainsAny<T[Key]>;
          }[keyof T] ? true : false
          : false;
type RuntimeValue<T> =
  T extends string ? string extends T ? string : T
    : T extends readonly (infer Item)[] ? RuntimeValue<Item>[]
      : T extends object ? { -readonly [Key in keyof T]: RuntimeValue<T[Key]> }
        : T;
type Equal<A, B> =
  IsAny<A> extends true ? false
    : IsAny<B> extends true ? false
      : IsNever<A> extends true ? IsNever<B>
        : IsNever<B> extends true ? false
          : [A] extends [B] ? [B] extends [A] ? true : false
            : false;

type ExactDecoder<Field, Schema extends ZodType> =
  true extends ContainsAny<output<Schema>> ? never
    : true extends ContainsAny<input<Schema>> ? never
      : Equal<output<Schema>, RuntimeValue<Field>> extends true
        ? Equal<input<Schema>, RuntimeValue<Field>> extends true ? Schema : never
        : never;

type ExactShape<Domain extends object, Shape extends Record<keyof Domain, ZodType>> = {
  [Key in keyof Domain]-?: ExactDecoder<Domain[Key], Shape[Key]>;
} & Record<Exclude<keyof Shape, keyof Domain>, never>;

/**
 * Infer each concrete decoder before checking exact input/output parity with its domain field.
 *
 * This rejects narrower unions, coercing schemas, nested `any`, `never`, missing keys, and extra
 * keys.
 */
export const defineExhaustiveShape =
  <Domain extends object>() =>
    <const Shape extends Record<keyof Domain, ZodType>>(
      shape: Shape & ExactShape<Domain, Shape>,
    ): Shape => shape;
