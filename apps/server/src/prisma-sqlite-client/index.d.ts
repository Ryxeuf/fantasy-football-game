
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Match
 * 
 */
export type Match = $Result.DefaultSelection<Prisma.$MatchPayload>
/**
 * Model Turn
 * 
 */
export type Turn = $Result.DefaultSelection<Prisma.$TurnPayload>
/**
 * Model TeamSelection
 * 
 */
export type TeamSelection = $Result.DefaultSelection<Prisma.$TeamSelectionPayload>
/**
 * Model Team
 * 
 */
export type Team = $Result.DefaultSelection<Prisma.$TeamPayload>
/**
 * Model TeamPlayer
 * 
 */
export type TeamPlayer = $Result.DefaultSelection<Prisma.$TeamPlayerPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.match`: Exposes CRUD operations for the **Match** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Matches
    * const matches = await prisma.match.findMany()
    * ```
    */
  get match(): Prisma.MatchDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.turn`: Exposes CRUD operations for the **Turn** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Turns
    * const turns = await prisma.turn.findMany()
    * ```
    */
  get turn(): Prisma.TurnDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.teamSelection`: Exposes CRUD operations for the **TeamSelection** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TeamSelections
    * const teamSelections = await prisma.teamSelection.findMany()
    * ```
    */
  get teamSelection(): Prisma.TeamSelectionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.team`: Exposes CRUD operations for the **Team** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Teams
    * const teams = await prisma.team.findMany()
    * ```
    */
  get team(): Prisma.TeamDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.teamPlayer`: Exposes CRUD operations for the **TeamPlayer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TeamPlayers
    * const teamPlayers = await prisma.teamPlayer.findMany()
    * ```
    */
  get teamPlayer(): Prisma.TeamPlayerDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.16.2
   * Query Engine version: 1c57fdcd7e44b29b9313256c76699e91c3ac3c43
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Match: 'Match',
    Turn: 'Turn',
    TeamSelection: 'TeamSelection',
    Team: 'Team',
    TeamPlayer: 'TeamPlayer'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "match" | "turn" | "teamSelection" | "team" | "teamPlayer"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Match: {
        payload: Prisma.$MatchPayload<ExtArgs>
        fields: Prisma.MatchFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MatchFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MatchFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>
          }
          findFirst: {
            args: Prisma.MatchFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MatchFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>
          }
          findMany: {
            args: Prisma.MatchFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>[]
          }
          create: {
            args: Prisma.MatchCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>
          }
          createMany: {
            args: Prisma.MatchCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MatchCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>[]
          }
          delete: {
            args: Prisma.MatchDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>
          }
          update: {
            args: Prisma.MatchUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>
          }
          deleteMany: {
            args: Prisma.MatchDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MatchUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MatchUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>[]
          }
          upsert: {
            args: Prisma.MatchUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MatchPayload>
          }
          aggregate: {
            args: Prisma.MatchAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMatch>
          }
          groupBy: {
            args: Prisma.MatchGroupByArgs<ExtArgs>
            result: $Utils.Optional<MatchGroupByOutputType>[]
          }
          count: {
            args: Prisma.MatchCountArgs<ExtArgs>
            result: $Utils.Optional<MatchCountAggregateOutputType> | number
          }
        }
      }
      Turn: {
        payload: Prisma.$TurnPayload<ExtArgs>
        fields: Prisma.TurnFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TurnFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TurnFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>
          }
          findFirst: {
            args: Prisma.TurnFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TurnFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>
          }
          findMany: {
            args: Prisma.TurnFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>[]
          }
          create: {
            args: Prisma.TurnCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>
          }
          createMany: {
            args: Prisma.TurnCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TurnCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>[]
          }
          delete: {
            args: Prisma.TurnDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>
          }
          update: {
            args: Prisma.TurnUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>
          }
          deleteMany: {
            args: Prisma.TurnDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TurnUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TurnUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>[]
          }
          upsert: {
            args: Prisma.TurnUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TurnPayload>
          }
          aggregate: {
            args: Prisma.TurnAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTurn>
          }
          groupBy: {
            args: Prisma.TurnGroupByArgs<ExtArgs>
            result: $Utils.Optional<TurnGroupByOutputType>[]
          }
          count: {
            args: Prisma.TurnCountArgs<ExtArgs>
            result: $Utils.Optional<TurnCountAggregateOutputType> | number
          }
        }
      }
      TeamSelection: {
        payload: Prisma.$TeamSelectionPayload<ExtArgs>
        fields: Prisma.TeamSelectionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TeamSelectionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TeamSelectionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>
          }
          findFirst: {
            args: Prisma.TeamSelectionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TeamSelectionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>
          }
          findMany: {
            args: Prisma.TeamSelectionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>[]
          }
          create: {
            args: Prisma.TeamSelectionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>
          }
          createMany: {
            args: Prisma.TeamSelectionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TeamSelectionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>[]
          }
          delete: {
            args: Prisma.TeamSelectionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>
          }
          update: {
            args: Prisma.TeamSelectionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>
          }
          deleteMany: {
            args: Prisma.TeamSelectionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TeamSelectionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TeamSelectionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>[]
          }
          upsert: {
            args: Prisma.TeamSelectionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamSelectionPayload>
          }
          aggregate: {
            args: Prisma.TeamSelectionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTeamSelection>
          }
          groupBy: {
            args: Prisma.TeamSelectionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TeamSelectionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TeamSelectionCountArgs<ExtArgs>
            result: $Utils.Optional<TeamSelectionCountAggregateOutputType> | number
          }
        }
      }
      Team: {
        payload: Prisma.$TeamPayload<ExtArgs>
        fields: Prisma.TeamFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TeamFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TeamFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          findFirst: {
            args: Prisma.TeamFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TeamFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          findMany: {
            args: Prisma.TeamFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>[]
          }
          create: {
            args: Prisma.TeamCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          createMany: {
            args: Prisma.TeamCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TeamCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>[]
          }
          delete: {
            args: Prisma.TeamDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          update: {
            args: Prisma.TeamUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          deleteMany: {
            args: Prisma.TeamDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TeamUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TeamUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>[]
          }
          upsert: {
            args: Prisma.TeamUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          aggregate: {
            args: Prisma.TeamAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTeam>
          }
          groupBy: {
            args: Prisma.TeamGroupByArgs<ExtArgs>
            result: $Utils.Optional<TeamGroupByOutputType>[]
          }
          count: {
            args: Prisma.TeamCountArgs<ExtArgs>
            result: $Utils.Optional<TeamCountAggregateOutputType> | number
          }
        }
      }
      TeamPlayer: {
        payload: Prisma.$TeamPlayerPayload<ExtArgs>
        fields: Prisma.TeamPlayerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TeamPlayerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TeamPlayerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>
          }
          findFirst: {
            args: Prisma.TeamPlayerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TeamPlayerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>
          }
          findMany: {
            args: Prisma.TeamPlayerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>[]
          }
          create: {
            args: Prisma.TeamPlayerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>
          }
          createMany: {
            args: Prisma.TeamPlayerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TeamPlayerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>[]
          }
          delete: {
            args: Prisma.TeamPlayerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>
          }
          update: {
            args: Prisma.TeamPlayerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>
          }
          deleteMany: {
            args: Prisma.TeamPlayerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TeamPlayerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TeamPlayerUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>[]
          }
          upsert: {
            args: Prisma.TeamPlayerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPlayerPayload>
          }
          aggregate: {
            args: Prisma.TeamPlayerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTeamPlayer>
          }
          groupBy: {
            args: Prisma.TeamPlayerGroupByArgs<ExtArgs>
            result: $Utils.Optional<TeamPlayerGroupByOutputType>[]
          }
          count: {
            args: Prisma.TeamPlayerCountArgs<ExtArgs>
            result: $Utils.Optional<TeamPlayerCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    match?: MatchOmit
    turn?: TurnOmit
    teamSelection?: TeamSelectionOmit
    team?: TeamOmit
    teamPlayer?: TeamPlayerOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    matches: number
    createdMatches: number
    teams: number
    teamSelections: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    matches?: boolean | UserCountOutputTypeCountMatchesArgs
    createdMatches?: boolean | UserCountOutputTypeCountCreatedMatchesArgs
    teams?: boolean | UserCountOutputTypeCountTeamsArgs
    teamSelections?: boolean | UserCountOutputTypeCountTeamSelectionsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MatchWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCreatedMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MatchWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountTeamsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountTeamSelectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamSelectionWhereInput
  }


  /**
   * Count Type MatchCountOutputType
   */

  export type MatchCountOutputType = {
    players: number
    turns: number
    teamSelections: number
  }

  export type MatchCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    players?: boolean | MatchCountOutputTypeCountPlayersArgs
    turns?: boolean | MatchCountOutputTypeCountTurnsArgs
    teamSelections?: boolean | MatchCountOutputTypeCountTeamSelectionsArgs
  }

  // Custom InputTypes
  /**
   * MatchCountOutputType without action
   */
  export type MatchCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MatchCountOutputType
     */
    select?: MatchCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * MatchCountOutputType without action
   */
  export type MatchCountOutputTypeCountPlayersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }

  /**
   * MatchCountOutputType without action
   */
  export type MatchCountOutputTypeCountTurnsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TurnWhereInput
  }

  /**
   * MatchCountOutputType without action
   */
  export type MatchCountOutputTypeCountTeamSelectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamSelectionWhereInput
  }


  /**
   * Count Type TeamCountOutputType
   */

  export type TeamCountOutputType = {
    players: number
    selections: number
  }

  export type TeamCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    players?: boolean | TeamCountOutputTypeCountPlayersArgs
    selections?: boolean | TeamCountOutputTypeCountSelectionsArgs
  }

  // Custom InputTypes
  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamCountOutputType
     */
    select?: TeamCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeCountPlayersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamPlayerWhereInput
  }

  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeCountSelectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamSelectionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    role: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    role: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    passwordHash: number
    name: number
    role: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    role?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    role?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    role?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    passwordHash: string
    name: string | null
    role: string
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    matches?: boolean | User$matchesArgs<ExtArgs>
    createdMatches?: boolean | User$createdMatchesArgs<ExtArgs>
    teams?: boolean | User$teamsArgs<ExtArgs>
    teamSelections?: boolean | User$teamSelectionsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "passwordHash" | "name" | "role" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    matches?: boolean | User$matchesArgs<ExtArgs>
    createdMatches?: boolean | User$createdMatchesArgs<ExtArgs>
    teams?: boolean | User$teamsArgs<ExtArgs>
    teamSelections?: boolean | User$teamSelectionsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      matches: Prisma.$MatchPayload<ExtArgs>[]
      createdMatches: Prisma.$MatchPayload<ExtArgs>[]
      teams: Prisma.$TeamPayload<ExtArgs>[]
      teamSelections: Prisma.$TeamSelectionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      passwordHash: string
      name: string | null
      role: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    matches<T extends User$matchesArgs<ExtArgs> = {}>(args?: Subset<T, User$matchesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    createdMatches<T extends User$createdMatchesArgs<ExtArgs> = {}>(args?: Subset<T, User$createdMatchesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    teams<T extends User$teamsArgs<ExtArgs> = {}>(args?: Subset<T, User$teamsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    teamSelections<T extends User$teamSelectionsArgs<ExtArgs> = {}>(args?: Subset<T, User$teamSelectionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly passwordHash: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.matches
   */
  export type User$matchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    where?: MatchWhereInput
    orderBy?: MatchOrderByWithRelationInput | MatchOrderByWithRelationInput[]
    cursor?: MatchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MatchScalarFieldEnum | MatchScalarFieldEnum[]
  }

  /**
   * User.createdMatches
   */
  export type User$createdMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    where?: MatchWhereInput
    orderBy?: MatchOrderByWithRelationInput | MatchOrderByWithRelationInput[]
    cursor?: MatchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MatchScalarFieldEnum | MatchScalarFieldEnum[]
  }

  /**
   * User.teams
   */
  export type User$teamsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    where?: TeamWhereInput
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    cursor?: TeamWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * User.teamSelections
   */
  export type User$teamSelectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    where?: TeamSelectionWhereInput
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    cursor?: TeamSelectionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TeamSelectionScalarFieldEnum | TeamSelectionScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Match
   */

  export type AggregateMatch = {
    _count: MatchCountAggregateOutputType | null
    _min: MatchMinAggregateOutputType | null
    _max: MatchMaxAggregateOutputType | null
  }

  export type MatchMinAggregateOutputType = {
    id: string | null
    createdAt: Date | null
    status: string | null
    seed: string | null
    creatorId: string | null
  }

  export type MatchMaxAggregateOutputType = {
    id: string | null
    createdAt: Date | null
    status: string | null
    seed: string | null
    creatorId: string | null
  }

  export type MatchCountAggregateOutputType = {
    id: number
    createdAt: number
    status: number
    seed: number
    creatorId: number
    _all: number
  }


  export type MatchMinAggregateInputType = {
    id?: true
    createdAt?: true
    status?: true
    seed?: true
    creatorId?: true
  }

  export type MatchMaxAggregateInputType = {
    id?: true
    createdAt?: true
    status?: true
    seed?: true
    creatorId?: true
  }

  export type MatchCountAggregateInputType = {
    id?: true
    createdAt?: true
    status?: true
    seed?: true
    creatorId?: true
    _all?: true
  }

  export type MatchAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Match to aggregate.
     */
    where?: MatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Matches to fetch.
     */
    orderBy?: MatchOrderByWithRelationInput | MatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Matches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Matches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Matches
    **/
    _count?: true | MatchCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MatchMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MatchMaxAggregateInputType
  }

  export type GetMatchAggregateType<T extends MatchAggregateArgs> = {
        [P in keyof T & keyof AggregateMatch]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMatch[P]>
      : GetScalarType<T[P], AggregateMatch[P]>
  }




  export type MatchGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MatchWhereInput
    orderBy?: MatchOrderByWithAggregationInput | MatchOrderByWithAggregationInput[]
    by: MatchScalarFieldEnum[] | MatchScalarFieldEnum
    having?: MatchScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MatchCountAggregateInputType | true
    _min?: MatchMinAggregateInputType
    _max?: MatchMaxAggregateInputType
  }

  export type MatchGroupByOutputType = {
    id: string
    createdAt: Date
    status: string
    seed: string
    creatorId: string | null
    _count: MatchCountAggregateOutputType | null
    _min: MatchMinAggregateOutputType | null
    _max: MatchMaxAggregateOutputType | null
  }

  type GetMatchGroupByPayload<T extends MatchGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MatchGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MatchGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MatchGroupByOutputType[P]>
            : GetScalarType<T[P], MatchGroupByOutputType[P]>
        }
      >
    >


  export type MatchSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    status?: boolean
    seed?: boolean
    creatorId?: boolean
    creator?: boolean | Match$creatorArgs<ExtArgs>
    players?: boolean | Match$playersArgs<ExtArgs>
    turns?: boolean | Match$turnsArgs<ExtArgs>
    teamSelections?: boolean | Match$teamSelectionsArgs<ExtArgs>
    _count?: boolean | MatchCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["match"]>

  export type MatchSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    status?: boolean
    seed?: boolean
    creatorId?: boolean
    creator?: boolean | Match$creatorArgs<ExtArgs>
  }, ExtArgs["result"]["match"]>

  export type MatchSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    status?: boolean
    seed?: boolean
    creatorId?: boolean
    creator?: boolean | Match$creatorArgs<ExtArgs>
  }, ExtArgs["result"]["match"]>

  export type MatchSelectScalar = {
    id?: boolean
    createdAt?: boolean
    status?: boolean
    seed?: boolean
    creatorId?: boolean
  }

  export type MatchOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "createdAt" | "status" | "seed" | "creatorId", ExtArgs["result"]["match"]>
  export type MatchInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | Match$creatorArgs<ExtArgs>
    players?: boolean | Match$playersArgs<ExtArgs>
    turns?: boolean | Match$turnsArgs<ExtArgs>
    teamSelections?: boolean | Match$teamSelectionsArgs<ExtArgs>
    _count?: boolean | MatchCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type MatchIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | Match$creatorArgs<ExtArgs>
  }
  export type MatchIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | Match$creatorArgs<ExtArgs>
  }

  export type $MatchPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Match"
    objects: {
      creator: Prisma.$UserPayload<ExtArgs> | null
      players: Prisma.$UserPayload<ExtArgs>[]
      turns: Prisma.$TurnPayload<ExtArgs>[]
      teamSelections: Prisma.$TeamSelectionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      createdAt: Date
      status: string
      seed: string
      creatorId: string | null
    }, ExtArgs["result"]["match"]>
    composites: {}
  }

  type MatchGetPayload<S extends boolean | null | undefined | MatchDefaultArgs> = $Result.GetResult<Prisma.$MatchPayload, S>

  type MatchCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MatchFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MatchCountAggregateInputType | true
    }

  export interface MatchDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Match'], meta: { name: 'Match' } }
    /**
     * Find zero or one Match that matches the filter.
     * @param {MatchFindUniqueArgs} args - Arguments to find a Match
     * @example
     * // Get one Match
     * const match = await prisma.match.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MatchFindUniqueArgs>(args: SelectSubset<T, MatchFindUniqueArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Match that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MatchFindUniqueOrThrowArgs} args - Arguments to find a Match
     * @example
     * // Get one Match
     * const match = await prisma.match.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MatchFindUniqueOrThrowArgs>(args: SelectSubset<T, MatchFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Match that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchFindFirstArgs} args - Arguments to find a Match
     * @example
     * // Get one Match
     * const match = await prisma.match.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MatchFindFirstArgs>(args?: SelectSubset<T, MatchFindFirstArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Match that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchFindFirstOrThrowArgs} args - Arguments to find a Match
     * @example
     * // Get one Match
     * const match = await prisma.match.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MatchFindFirstOrThrowArgs>(args?: SelectSubset<T, MatchFindFirstOrThrowArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Matches that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Matches
     * const matches = await prisma.match.findMany()
     * 
     * // Get first 10 Matches
     * const matches = await prisma.match.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const matchWithIdOnly = await prisma.match.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MatchFindManyArgs>(args?: SelectSubset<T, MatchFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Match.
     * @param {MatchCreateArgs} args - Arguments to create a Match.
     * @example
     * // Create one Match
     * const Match = await prisma.match.create({
     *   data: {
     *     // ... data to create a Match
     *   }
     * })
     * 
     */
    create<T extends MatchCreateArgs>(args: SelectSubset<T, MatchCreateArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Matches.
     * @param {MatchCreateManyArgs} args - Arguments to create many Matches.
     * @example
     * // Create many Matches
     * const match = await prisma.match.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MatchCreateManyArgs>(args?: SelectSubset<T, MatchCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Matches and returns the data saved in the database.
     * @param {MatchCreateManyAndReturnArgs} args - Arguments to create many Matches.
     * @example
     * // Create many Matches
     * const match = await prisma.match.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Matches and only return the `id`
     * const matchWithIdOnly = await prisma.match.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MatchCreateManyAndReturnArgs>(args?: SelectSubset<T, MatchCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Match.
     * @param {MatchDeleteArgs} args - Arguments to delete one Match.
     * @example
     * // Delete one Match
     * const Match = await prisma.match.delete({
     *   where: {
     *     // ... filter to delete one Match
     *   }
     * })
     * 
     */
    delete<T extends MatchDeleteArgs>(args: SelectSubset<T, MatchDeleteArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Match.
     * @param {MatchUpdateArgs} args - Arguments to update one Match.
     * @example
     * // Update one Match
     * const match = await prisma.match.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MatchUpdateArgs>(args: SelectSubset<T, MatchUpdateArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Matches.
     * @param {MatchDeleteManyArgs} args - Arguments to filter Matches to delete.
     * @example
     * // Delete a few Matches
     * const { count } = await prisma.match.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MatchDeleteManyArgs>(args?: SelectSubset<T, MatchDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Matches.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Matches
     * const match = await prisma.match.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MatchUpdateManyArgs>(args: SelectSubset<T, MatchUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Matches and returns the data updated in the database.
     * @param {MatchUpdateManyAndReturnArgs} args - Arguments to update many Matches.
     * @example
     * // Update many Matches
     * const match = await prisma.match.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Matches and only return the `id`
     * const matchWithIdOnly = await prisma.match.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MatchUpdateManyAndReturnArgs>(args: SelectSubset<T, MatchUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Match.
     * @param {MatchUpsertArgs} args - Arguments to update or create a Match.
     * @example
     * // Update or create a Match
     * const match = await prisma.match.upsert({
     *   create: {
     *     // ... data to create a Match
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Match we want to update
     *   }
     * })
     */
    upsert<T extends MatchUpsertArgs>(args: SelectSubset<T, MatchUpsertArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Matches.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchCountArgs} args - Arguments to filter Matches to count.
     * @example
     * // Count the number of Matches
     * const count = await prisma.match.count({
     *   where: {
     *     // ... the filter for the Matches we want to count
     *   }
     * })
    **/
    count<T extends MatchCountArgs>(
      args?: Subset<T, MatchCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MatchCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Match.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MatchAggregateArgs>(args: Subset<T, MatchAggregateArgs>): Prisma.PrismaPromise<GetMatchAggregateType<T>>

    /**
     * Group by Match.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MatchGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MatchGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MatchGroupByArgs['orderBy'] }
        : { orderBy?: MatchGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MatchGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMatchGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Match model
   */
  readonly fields: MatchFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Match.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MatchClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    creator<T extends Match$creatorArgs<ExtArgs> = {}>(args?: Subset<T, Match$creatorArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    players<T extends Match$playersArgs<ExtArgs> = {}>(args?: Subset<T, Match$playersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    turns<T extends Match$turnsArgs<ExtArgs> = {}>(args?: Subset<T, Match$turnsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    teamSelections<T extends Match$teamSelectionsArgs<ExtArgs> = {}>(args?: Subset<T, Match$teamSelectionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Match model
   */
  interface MatchFieldRefs {
    readonly id: FieldRef<"Match", 'String'>
    readonly createdAt: FieldRef<"Match", 'DateTime'>
    readonly status: FieldRef<"Match", 'String'>
    readonly seed: FieldRef<"Match", 'String'>
    readonly creatorId: FieldRef<"Match", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Match findUnique
   */
  export type MatchFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * Filter, which Match to fetch.
     */
    where: MatchWhereUniqueInput
  }

  /**
   * Match findUniqueOrThrow
   */
  export type MatchFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * Filter, which Match to fetch.
     */
    where: MatchWhereUniqueInput
  }

  /**
   * Match findFirst
   */
  export type MatchFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * Filter, which Match to fetch.
     */
    where?: MatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Matches to fetch.
     */
    orderBy?: MatchOrderByWithRelationInput | MatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Matches.
     */
    cursor?: MatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Matches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Matches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Matches.
     */
    distinct?: MatchScalarFieldEnum | MatchScalarFieldEnum[]
  }

  /**
   * Match findFirstOrThrow
   */
  export type MatchFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * Filter, which Match to fetch.
     */
    where?: MatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Matches to fetch.
     */
    orderBy?: MatchOrderByWithRelationInput | MatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Matches.
     */
    cursor?: MatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Matches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Matches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Matches.
     */
    distinct?: MatchScalarFieldEnum | MatchScalarFieldEnum[]
  }

  /**
   * Match findMany
   */
  export type MatchFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * Filter, which Matches to fetch.
     */
    where?: MatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Matches to fetch.
     */
    orderBy?: MatchOrderByWithRelationInput | MatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Matches.
     */
    cursor?: MatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Matches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Matches.
     */
    skip?: number
    distinct?: MatchScalarFieldEnum | MatchScalarFieldEnum[]
  }

  /**
   * Match create
   */
  export type MatchCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * The data needed to create a Match.
     */
    data: XOR<MatchCreateInput, MatchUncheckedCreateInput>
  }

  /**
   * Match createMany
   */
  export type MatchCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Matches.
     */
    data: MatchCreateManyInput | MatchCreateManyInput[]
  }

  /**
   * Match createManyAndReturn
   */
  export type MatchCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * The data used to create many Matches.
     */
    data: MatchCreateManyInput | MatchCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Match update
   */
  export type MatchUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * The data needed to update a Match.
     */
    data: XOR<MatchUpdateInput, MatchUncheckedUpdateInput>
    /**
     * Choose, which Match to update.
     */
    where: MatchWhereUniqueInput
  }

  /**
   * Match updateMany
   */
  export type MatchUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Matches.
     */
    data: XOR<MatchUpdateManyMutationInput, MatchUncheckedUpdateManyInput>
    /**
     * Filter which Matches to update
     */
    where?: MatchWhereInput
    /**
     * Limit how many Matches to update.
     */
    limit?: number
  }

  /**
   * Match updateManyAndReturn
   */
  export type MatchUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * The data used to update Matches.
     */
    data: XOR<MatchUpdateManyMutationInput, MatchUncheckedUpdateManyInput>
    /**
     * Filter which Matches to update
     */
    where?: MatchWhereInput
    /**
     * Limit how many Matches to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Match upsert
   */
  export type MatchUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * The filter to search for the Match to update in case it exists.
     */
    where: MatchWhereUniqueInput
    /**
     * In case the Match found by the `where` argument doesn't exist, create a new Match with this data.
     */
    create: XOR<MatchCreateInput, MatchUncheckedCreateInput>
    /**
     * In case the Match was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MatchUpdateInput, MatchUncheckedUpdateInput>
  }

  /**
   * Match delete
   */
  export type MatchDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
    /**
     * Filter which Match to delete.
     */
    where: MatchWhereUniqueInput
  }

  /**
   * Match deleteMany
   */
  export type MatchDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Matches to delete
     */
    where?: MatchWhereInput
    /**
     * Limit how many Matches to delete.
     */
    limit?: number
  }

  /**
   * Match.creator
   */
  export type Match$creatorArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * Match.players
   */
  export type Match$playersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * Match.turns
   */
  export type Match$turnsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    where?: TurnWhereInput
    orderBy?: TurnOrderByWithRelationInput | TurnOrderByWithRelationInput[]
    cursor?: TurnWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TurnScalarFieldEnum | TurnScalarFieldEnum[]
  }

  /**
   * Match.teamSelections
   */
  export type Match$teamSelectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    where?: TeamSelectionWhereInput
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    cursor?: TeamSelectionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TeamSelectionScalarFieldEnum | TeamSelectionScalarFieldEnum[]
  }

  /**
   * Match without action
   */
  export type MatchDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Match
     */
    select?: MatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Match
     */
    omit?: MatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MatchInclude<ExtArgs> | null
  }


  /**
   * Model Turn
   */

  export type AggregateTurn = {
    _count: TurnCountAggregateOutputType | null
    _avg: TurnAvgAggregateOutputType | null
    _sum: TurnSumAggregateOutputType | null
    _min: TurnMinAggregateOutputType | null
    _max: TurnMaxAggregateOutputType | null
  }

  export type TurnAvgAggregateOutputType = {
    number: number | null
  }

  export type TurnSumAggregateOutputType = {
    number: number | null
  }

  export type TurnMinAggregateOutputType = {
    id: string | null
    matchId: string | null
    number: number | null
    createdAt: Date | null
  }

  export type TurnMaxAggregateOutputType = {
    id: string | null
    matchId: string | null
    number: number | null
    createdAt: Date | null
  }

  export type TurnCountAggregateOutputType = {
    id: number
    matchId: number
    number: number
    payload: number
    createdAt: number
    _all: number
  }


  export type TurnAvgAggregateInputType = {
    number?: true
  }

  export type TurnSumAggregateInputType = {
    number?: true
  }

  export type TurnMinAggregateInputType = {
    id?: true
    matchId?: true
    number?: true
    createdAt?: true
  }

  export type TurnMaxAggregateInputType = {
    id?: true
    matchId?: true
    number?: true
    createdAt?: true
  }

  export type TurnCountAggregateInputType = {
    id?: true
    matchId?: true
    number?: true
    payload?: true
    createdAt?: true
    _all?: true
  }

  export type TurnAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Turn to aggregate.
     */
    where?: TurnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Turns to fetch.
     */
    orderBy?: TurnOrderByWithRelationInput | TurnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TurnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Turns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Turns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Turns
    **/
    _count?: true | TurnCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TurnAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TurnSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TurnMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TurnMaxAggregateInputType
  }

  export type GetTurnAggregateType<T extends TurnAggregateArgs> = {
        [P in keyof T & keyof AggregateTurn]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTurn[P]>
      : GetScalarType<T[P], AggregateTurn[P]>
  }




  export type TurnGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TurnWhereInput
    orderBy?: TurnOrderByWithAggregationInput | TurnOrderByWithAggregationInput[]
    by: TurnScalarFieldEnum[] | TurnScalarFieldEnum
    having?: TurnScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TurnCountAggregateInputType | true
    _avg?: TurnAvgAggregateInputType
    _sum?: TurnSumAggregateInputType
    _min?: TurnMinAggregateInputType
    _max?: TurnMaxAggregateInputType
  }

  export type TurnGroupByOutputType = {
    id: string
    matchId: string
    number: number
    payload: JsonValue
    createdAt: Date
    _count: TurnCountAggregateOutputType | null
    _avg: TurnAvgAggregateOutputType | null
    _sum: TurnSumAggregateOutputType | null
    _min: TurnMinAggregateOutputType | null
    _max: TurnMaxAggregateOutputType | null
  }

  type GetTurnGroupByPayload<T extends TurnGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TurnGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TurnGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TurnGroupByOutputType[P]>
            : GetScalarType<T[P], TurnGroupByOutputType[P]>
        }
      >
    >


  export type TurnSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    number?: boolean
    payload?: boolean
    createdAt?: boolean
    match?: boolean | MatchDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["turn"]>

  export type TurnSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    number?: boolean
    payload?: boolean
    createdAt?: boolean
    match?: boolean | MatchDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["turn"]>

  export type TurnSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    number?: boolean
    payload?: boolean
    createdAt?: boolean
    match?: boolean | MatchDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["turn"]>

  export type TurnSelectScalar = {
    id?: boolean
    matchId?: boolean
    number?: boolean
    payload?: boolean
    createdAt?: boolean
  }

  export type TurnOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "matchId" | "number" | "payload" | "createdAt", ExtArgs["result"]["turn"]>
  export type TurnInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | MatchDefaultArgs<ExtArgs>
  }
  export type TurnIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | MatchDefaultArgs<ExtArgs>
  }
  export type TurnIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | MatchDefaultArgs<ExtArgs>
  }

  export type $TurnPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Turn"
    objects: {
      match: Prisma.$MatchPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      matchId: string
      number: number
      payload: Prisma.JsonValue
      createdAt: Date
    }, ExtArgs["result"]["turn"]>
    composites: {}
  }

  type TurnGetPayload<S extends boolean | null | undefined | TurnDefaultArgs> = $Result.GetResult<Prisma.$TurnPayload, S>

  type TurnCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TurnFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TurnCountAggregateInputType | true
    }

  export interface TurnDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Turn'], meta: { name: 'Turn' } }
    /**
     * Find zero or one Turn that matches the filter.
     * @param {TurnFindUniqueArgs} args - Arguments to find a Turn
     * @example
     * // Get one Turn
     * const turn = await prisma.turn.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TurnFindUniqueArgs>(args: SelectSubset<T, TurnFindUniqueArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Turn that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TurnFindUniqueOrThrowArgs} args - Arguments to find a Turn
     * @example
     * // Get one Turn
     * const turn = await prisma.turn.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TurnFindUniqueOrThrowArgs>(args: SelectSubset<T, TurnFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Turn that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnFindFirstArgs} args - Arguments to find a Turn
     * @example
     * // Get one Turn
     * const turn = await prisma.turn.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TurnFindFirstArgs>(args?: SelectSubset<T, TurnFindFirstArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Turn that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnFindFirstOrThrowArgs} args - Arguments to find a Turn
     * @example
     * // Get one Turn
     * const turn = await prisma.turn.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TurnFindFirstOrThrowArgs>(args?: SelectSubset<T, TurnFindFirstOrThrowArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Turns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Turns
     * const turns = await prisma.turn.findMany()
     * 
     * // Get first 10 Turns
     * const turns = await prisma.turn.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const turnWithIdOnly = await prisma.turn.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TurnFindManyArgs>(args?: SelectSubset<T, TurnFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Turn.
     * @param {TurnCreateArgs} args - Arguments to create a Turn.
     * @example
     * // Create one Turn
     * const Turn = await prisma.turn.create({
     *   data: {
     *     // ... data to create a Turn
     *   }
     * })
     * 
     */
    create<T extends TurnCreateArgs>(args: SelectSubset<T, TurnCreateArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Turns.
     * @param {TurnCreateManyArgs} args - Arguments to create many Turns.
     * @example
     * // Create many Turns
     * const turn = await prisma.turn.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TurnCreateManyArgs>(args?: SelectSubset<T, TurnCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Turns and returns the data saved in the database.
     * @param {TurnCreateManyAndReturnArgs} args - Arguments to create many Turns.
     * @example
     * // Create many Turns
     * const turn = await prisma.turn.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Turns and only return the `id`
     * const turnWithIdOnly = await prisma.turn.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TurnCreateManyAndReturnArgs>(args?: SelectSubset<T, TurnCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Turn.
     * @param {TurnDeleteArgs} args - Arguments to delete one Turn.
     * @example
     * // Delete one Turn
     * const Turn = await prisma.turn.delete({
     *   where: {
     *     // ... filter to delete one Turn
     *   }
     * })
     * 
     */
    delete<T extends TurnDeleteArgs>(args: SelectSubset<T, TurnDeleteArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Turn.
     * @param {TurnUpdateArgs} args - Arguments to update one Turn.
     * @example
     * // Update one Turn
     * const turn = await prisma.turn.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TurnUpdateArgs>(args: SelectSubset<T, TurnUpdateArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Turns.
     * @param {TurnDeleteManyArgs} args - Arguments to filter Turns to delete.
     * @example
     * // Delete a few Turns
     * const { count } = await prisma.turn.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TurnDeleteManyArgs>(args?: SelectSubset<T, TurnDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Turns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Turns
     * const turn = await prisma.turn.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TurnUpdateManyArgs>(args: SelectSubset<T, TurnUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Turns and returns the data updated in the database.
     * @param {TurnUpdateManyAndReturnArgs} args - Arguments to update many Turns.
     * @example
     * // Update many Turns
     * const turn = await prisma.turn.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Turns and only return the `id`
     * const turnWithIdOnly = await prisma.turn.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TurnUpdateManyAndReturnArgs>(args: SelectSubset<T, TurnUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Turn.
     * @param {TurnUpsertArgs} args - Arguments to update or create a Turn.
     * @example
     * // Update or create a Turn
     * const turn = await prisma.turn.upsert({
     *   create: {
     *     // ... data to create a Turn
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Turn we want to update
     *   }
     * })
     */
    upsert<T extends TurnUpsertArgs>(args: SelectSubset<T, TurnUpsertArgs<ExtArgs>>): Prisma__TurnClient<$Result.GetResult<Prisma.$TurnPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Turns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnCountArgs} args - Arguments to filter Turns to count.
     * @example
     * // Count the number of Turns
     * const count = await prisma.turn.count({
     *   where: {
     *     // ... the filter for the Turns we want to count
     *   }
     * })
    **/
    count<T extends TurnCountArgs>(
      args?: Subset<T, TurnCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TurnCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Turn.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TurnAggregateArgs>(args: Subset<T, TurnAggregateArgs>): Prisma.PrismaPromise<GetTurnAggregateType<T>>

    /**
     * Group by Turn.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TurnGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TurnGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TurnGroupByArgs['orderBy'] }
        : { orderBy?: TurnGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TurnGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTurnGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Turn model
   */
  readonly fields: TurnFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Turn.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TurnClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    match<T extends MatchDefaultArgs<ExtArgs> = {}>(args?: Subset<T, MatchDefaultArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Turn model
   */
  interface TurnFieldRefs {
    readonly id: FieldRef<"Turn", 'String'>
    readonly matchId: FieldRef<"Turn", 'String'>
    readonly number: FieldRef<"Turn", 'Int'>
    readonly payload: FieldRef<"Turn", 'Json'>
    readonly createdAt: FieldRef<"Turn", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Turn findUnique
   */
  export type TurnFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * Filter, which Turn to fetch.
     */
    where: TurnWhereUniqueInput
  }

  /**
   * Turn findUniqueOrThrow
   */
  export type TurnFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * Filter, which Turn to fetch.
     */
    where: TurnWhereUniqueInput
  }

  /**
   * Turn findFirst
   */
  export type TurnFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * Filter, which Turn to fetch.
     */
    where?: TurnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Turns to fetch.
     */
    orderBy?: TurnOrderByWithRelationInput | TurnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Turns.
     */
    cursor?: TurnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Turns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Turns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Turns.
     */
    distinct?: TurnScalarFieldEnum | TurnScalarFieldEnum[]
  }

  /**
   * Turn findFirstOrThrow
   */
  export type TurnFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * Filter, which Turn to fetch.
     */
    where?: TurnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Turns to fetch.
     */
    orderBy?: TurnOrderByWithRelationInput | TurnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Turns.
     */
    cursor?: TurnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Turns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Turns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Turns.
     */
    distinct?: TurnScalarFieldEnum | TurnScalarFieldEnum[]
  }

  /**
   * Turn findMany
   */
  export type TurnFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * Filter, which Turns to fetch.
     */
    where?: TurnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Turns to fetch.
     */
    orderBy?: TurnOrderByWithRelationInput | TurnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Turns.
     */
    cursor?: TurnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Turns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Turns.
     */
    skip?: number
    distinct?: TurnScalarFieldEnum | TurnScalarFieldEnum[]
  }

  /**
   * Turn create
   */
  export type TurnCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * The data needed to create a Turn.
     */
    data: XOR<TurnCreateInput, TurnUncheckedCreateInput>
  }

  /**
   * Turn createMany
   */
  export type TurnCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Turns.
     */
    data: TurnCreateManyInput | TurnCreateManyInput[]
  }

  /**
   * Turn createManyAndReturn
   */
  export type TurnCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * The data used to create many Turns.
     */
    data: TurnCreateManyInput | TurnCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Turn update
   */
  export type TurnUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * The data needed to update a Turn.
     */
    data: XOR<TurnUpdateInput, TurnUncheckedUpdateInput>
    /**
     * Choose, which Turn to update.
     */
    where: TurnWhereUniqueInput
  }

  /**
   * Turn updateMany
   */
  export type TurnUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Turns.
     */
    data: XOR<TurnUpdateManyMutationInput, TurnUncheckedUpdateManyInput>
    /**
     * Filter which Turns to update
     */
    where?: TurnWhereInput
    /**
     * Limit how many Turns to update.
     */
    limit?: number
  }

  /**
   * Turn updateManyAndReturn
   */
  export type TurnUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * The data used to update Turns.
     */
    data: XOR<TurnUpdateManyMutationInput, TurnUncheckedUpdateManyInput>
    /**
     * Filter which Turns to update
     */
    where?: TurnWhereInput
    /**
     * Limit how many Turns to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Turn upsert
   */
  export type TurnUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * The filter to search for the Turn to update in case it exists.
     */
    where: TurnWhereUniqueInput
    /**
     * In case the Turn found by the `where` argument doesn't exist, create a new Turn with this data.
     */
    create: XOR<TurnCreateInput, TurnUncheckedCreateInput>
    /**
     * In case the Turn was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TurnUpdateInput, TurnUncheckedUpdateInput>
  }

  /**
   * Turn delete
   */
  export type TurnDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
    /**
     * Filter which Turn to delete.
     */
    where: TurnWhereUniqueInput
  }

  /**
   * Turn deleteMany
   */
  export type TurnDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Turns to delete
     */
    where?: TurnWhereInput
    /**
     * Limit how many Turns to delete.
     */
    limit?: number
  }

  /**
   * Turn without action
   */
  export type TurnDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Turn
     */
    select?: TurnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Turn
     */
    omit?: TurnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TurnInclude<ExtArgs> | null
  }


  /**
   * Model TeamSelection
   */

  export type AggregateTeamSelection = {
    _count: TeamSelectionCountAggregateOutputType | null
    _min: TeamSelectionMinAggregateOutputType | null
    _max: TeamSelectionMaxAggregateOutputType | null
  }

  export type TeamSelectionMinAggregateOutputType = {
    id: string | null
    matchId: string | null
    userId: string | null
    team: string | null
    teamId: string | null
    createdAt: Date | null
  }

  export type TeamSelectionMaxAggregateOutputType = {
    id: string | null
    matchId: string | null
    userId: string | null
    team: string | null
    teamId: string | null
    createdAt: Date | null
  }

  export type TeamSelectionCountAggregateOutputType = {
    id: number
    matchId: number
    userId: number
    team: number
    teamId: number
    createdAt: number
    _all: number
  }


  export type TeamSelectionMinAggregateInputType = {
    id?: true
    matchId?: true
    userId?: true
    team?: true
    teamId?: true
    createdAt?: true
  }

  export type TeamSelectionMaxAggregateInputType = {
    id?: true
    matchId?: true
    userId?: true
    team?: true
    teamId?: true
    createdAt?: true
  }

  export type TeamSelectionCountAggregateInputType = {
    id?: true
    matchId?: true
    userId?: true
    team?: true
    teamId?: true
    createdAt?: true
    _all?: true
  }

  export type TeamSelectionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TeamSelection to aggregate.
     */
    where?: TeamSelectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamSelections to fetch.
     */
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TeamSelectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamSelections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamSelections.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TeamSelections
    **/
    _count?: true | TeamSelectionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TeamSelectionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TeamSelectionMaxAggregateInputType
  }

  export type GetTeamSelectionAggregateType<T extends TeamSelectionAggregateArgs> = {
        [P in keyof T & keyof AggregateTeamSelection]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTeamSelection[P]>
      : GetScalarType<T[P], AggregateTeamSelection[P]>
  }




  export type TeamSelectionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamSelectionWhereInput
    orderBy?: TeamSelectionOrderByWithAggregationInput | TeamSelectionOrderByWithAggregationInput[]
    by: TeamSelectionScalarFieldEnum[] | TeamSelectionScalarFieldEnum
    having?: TeamSelectionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TeamSelectionCountAggregateInputType | true
    _min?: TeamSelectionMinAggregateInputType
    _max?: TeamSelectionMaxAggregateInputType
  }

  export type TeamSelectionGroupByOutputType = {
    id: string
    matchId: string
    userId: string
    team: string
    teamId: string | null
    createdAt: Date
    _count: TeamSelectionCountAggregateOutputType | null
    _min: TeamSelectionMinAggregateOutputType | null
    _max: TeamSelectionMaxAggregateOutputType | null
  }

  type GetTeamSelectionGroupByPayload<T extends TeamSelectionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TeamSelectionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TeamSelectionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TeamSelectionGroupByOutputType[P]>
            : GetScalarType<T[P], TeamSelectionGroupByOutputType[P]>
        }
      >
    >


  export type TeamSelectionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    userId?: boolean
    team?: boolean
    teamId?: boolean
    createdAt?: boolean
    match?: boolean | MatchDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
    teamRef?: boolean | TeamSelection$teamRefArgs<ExtArgs>
  }, ExtArgs["result"]["teamSelection"]>

  export type TeamSelectionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    userId?: boolean
    team?: boolean
    teamId?: boolean
    createdAt?: boolean
    match?: boolean | MatchDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
    teamRef?: boolean | TeamSelection$teamRefArgs<ExtArgs>
  }, ExtArgs["result"]["teamSelection"]>

  export type TeamSelectionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    userId?: boolean
    team?: boolean
    teamId?: boolean
    createdAt?: boolean
    match?: boolean | MatchDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
    teamRef?: boolean | TeamSelection$teamRefArgs<ExtArgs>
  }, ExtArgs["result"]["teamSelection"]>

  export type TeamSelectionSelectScalar = {
    id?: boolean
    matchId?: boolean
    userId?: boolean
    team?: boolean
    teamId?: boolean
    createdAt?: boolean
  }

  export type TeamSelectionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "matchId" | "userId" | "team" | "teamId" | "createdAt", ExtArgs["result"]["teamSelection"]>
  export type TeamSelectionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | MatchDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
    teamRef?: boolean | TeamSelection$teamRefArgs<ExtArgs>
  }
  export type TeamSelectionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | MatchDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
    teamRef?: boolean | TeamSelection$teamRefArgs<ExtArgs>
  }
  export type TeamSelectionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | MatchDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
    teamRef?: boolean | TeamSelection$teamRefArgs<ExtArgs>
  }

  export type $TeamSelectionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TeamSelection"
    objects: {
      match: Prisma.$MatchPayload<ExtArgs>
      user: Prisma.$UserPayload<ExtArgs>
      teamRef: Prisma.$TeamPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      matchId: string
      userId: string
      team: string
      teamId: string | null
      createdAt: Date
    }, ExtArgs["result"]["teamSelection"]>
    composites: {}
  }

  type TeamSelectionGetPayload<S extends boolean | null | undefined | TeamSelectionDefaultArgs> = $Result.GetResult<Prisma.$TeamSelectionPayload, S>

  type TeamSelectionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TeamSelectionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TeamSelectionCountAggregateInputType | true
    }

  export interface TeamSelectionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TeamSelection'], meta: { name: 'TeamSelection' } }
    /**
     * Find zero or one TeamSelection that matches the filter.
     * @param {TeamSelectionFindUniqueArgs} args - Arguments to find a TeamSelection
     * @example
     * // Get one TeamSelection
     * const teamSelection = await prisma.teamSelection.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TeamSelectionFindUniqueArgs>(args: SelectSubset<T, TeamSelectionFindUniqueArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TeamSelection that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TeamSelectionFindUniqueOrThrowArgs} args - Arguments to find a TeamSelection
     * @example
     * // Get one TeamSelection
     * const teamSelection = await prisma.teamSelection.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TeamSelectionFindUniqueOrThrowArgs>(args: SelectSubset<T, TeamSelectionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TeamSelection that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionFindFirstArgs} args - Arguments to find a TeamSelection
     * @example
     * // Get one TeamSelection
     * const teamSelection = await prisma.teamSelection.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TeamSelectionFindFirstArgs>(args?: SelectSubset<T, TeamSelectionFindFirstArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TeamSelection that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionFindFirstOrThrowArgs} args - Arguments to find a TeamSelection
     * @example
     * // Get one TeamSelection
     * const teamSelection = await prisma.teamSelection.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TeamSelectionFindFirstOrThrowArgs>(args?: SelectSubset<T, TeamSelectionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TeamSelections that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TeamSelections
     * const teamSelections = await prisma.teamSelection.findMany()
     * 
     * // Get first 10 TeamSelections
     * const teamSelections = await prisma.teamSelection.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const teamSelectionWithIdOnly = await prisma.teamSelection.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TeamSelectionFindManyArgs>(args?: SelectSubset<T, TeamSelectionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TeamSelection.
     * @param {TeamSelectionCreateArgs} args - Arguments to create a TeamSelection.
     * @example
     * // Create one TeamSelection
     * const TeamSelection = await prisma.teamSelection.create({
     *   data: {
     *     // ... data to create a TeamSelection
     *   }
     * })
     * 
     */
    create<T extends TeamSelectionCreateArgs>(args: SelectSubset<T, TeamSelectionCreateArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TeamSelections.
     * @param {TeamSelectionCreateManyArgs} args - Arguments to create many TeamSelections.
     * @example
     * // Create many TeamSelections
     * const teamSelection = await prisma.teamSelection.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TeamSelectionCreateManyArgs>(args?: SelectSubset<T, TeamSelectionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TeamSelections and returns the data saved in the database.
     * @param {TeamSelectionCreateManyAndReturnArgs} args - Arguments to create many TeamSelections.
     * @example
     * // Create many TeamSelections
     * const teamSelection = await prisma.teamSelection.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TeamSelections and only return the `id`
     * const teamSelectionWithIdOnly = await prisma.teamSelection.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TeamSelectionCreateManyAndReturnArgs>(args?: SelectSubset<T, TeamSelectionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TeamSelection.
     * @param {TeamSelectionDeleteArgs} args - Arguments to delete one TeamSelection.
     * @example
     * // Delete one TeamSelection
     * const TeamSelection = await prisma.teamSelection.delete({
     *   where: {
     *     // ... filter to delete one TeamSelection
     *   }
     * })
     * 
     */
    delete<T extends TeamSelectionDeleteArgs>(args: SelectSubset<T, TeamSelectionDeleteArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TeamSelection.
     * @param {TeamSelectionUpdateArgs} args - Arguments to update one TeamSelection.
     * @example
     * // Update one TeamSelection
     * const teamSelection = await prisma.teamSelection.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TeamSelectionUpdateArgs>(args: SelectSubset<T, TeamSelectionUpdateArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TeamSelections.
     * @param {TeamSelectionDeleteManyArgs} args - Arguments to filter TeamSelections to delete.
     * @example
     * // Delete a few TeamSelections
     * const { count } = await prisma.teamSelection.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TeamSelectionDeleteManyArgs>(args?: SelectSubset<T, TeamSelectionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TeamSelections.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TeamSelections
     * const teamSelection = await prisma.teamSelection.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TeamSelectionUpdateManyArgs>(args: SelectSubset<T, TeamSelectionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TeamSelections and returns the data updated in the database.
     * @param {TeamSelectionUpdateManyAndReturnArgs} args - Arguments to update many TeamSelections.
     * @example
     * // Update many TeamSelections
     * const teamSelection = await prisma.teamSelection.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TeamSelections and only return the `id`
     * const teamSelectionWithIdOnly = await prisma.teamSelection.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TeamSelectionUpdateManyAndReturnArgs>(args: SelectSubset<T, TeamSelectionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TeamSelection.
     * @param {TeamSelectionUpsertArgs} args - Arguments to update or create a TeamSelection.
     * @example
     * // Update or create a TeamSelection
     * const teamSelection = await prisma.teamSelection.upsert({
     *   create: {
     *     // ... data to create a TeamSelection
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TeamSelection we want to update
     *   }
     * })
     */
    upsert<T extends TeamSelectionUpsertArgs>(args: SelectSubset<T, TeamSelectionUpsertArgs<ExtArgs>>): Prisma__TeamSelectionClient<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TeamSelections.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionCountArgs} args - Arguments to filter TeamSelections to count.
     * @example
     * // Count the number of TeamSelections
     * const count = await prisma.teamSelection.count({
     *   where: {
     *     // ... the filter for the TeamSelections we want to count
     *   }
     * })
    **/
    count<T extends TeamSelectionCountArgs>(
      args?: Subset<T, TeamSelectionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TeamSelectionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TeamSelection.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TeamSelectionAggregateArgs>(args: Subset<T, TeamSelectionAggregateArgs>): Prisma.PrismaPromise<GetTeamSelectionAggregateType<T>>

    /**
     * Group by TeamSelection.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamSelectionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TeamSelectionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TeamSelectionGroupByArgs['orderBy'] }
        : { orderBy?: TeamSelectionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TeamSelectionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTeamSelectionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TeamSelection model
   */
  readonly fields: TeamSelectionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TeamSelection.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TeamSelectionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    match<T extends MatchDefaultArgs<ExtArgs> = {}>(args?: Subset<T, MatchDefaultArgs<ExtArgs>>): Prisma__MatchClient<$Result.GetResult<Prisma.$MatchPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    teamRef<T extends TeamSelection$teamRefArgs<ExtArgs> = {}>(args?: Subset<T, TeamSelection$teamRefArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TeamSelection model
   */
  interface TeamSelectionFieldRefs {
    readonly id: FieldRef<"TeamSelection", 'String'>
    readonly matchId: FieldRef<"TeamSelection", 'String'>
    readonly userId: FieldRef<"TeamSelection", 'String'>
    readonly team: FieldRef<"TeamSelection", 'String'>
    readonly teamId: FieldRef<"TeamSelection", 'String'>
    readonly createdAt: FieldRef<"TeamSelection", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TeamSelection findUnique
   */
  export type TeamSelectionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * Filter, which TeamSelection to fetch.
     */
    where: TeamSelectionWhereUniqueInput
  }

  /**
   * TeamSelection findUniqueOrThrow
   */
  export type TeamSelectionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * Filter, which TeamSelection to fetch.
     */
    where: TeamSelectionWhereUniqueInput
  }

  /**
   * TeamSelection findFirst
   */
  export type TeamSelectionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * Filter, which TeamSelection to fetch.
     */
    where?: TeamSelectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamSelections to fetch.
     */
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TeamSelections.
     */
    cursor?: TeamSelectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamSelections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamSelections.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TeamSelections.
     */
    distinct?: TeamSelectionScalarFieldEnum | TeamSelectionScalarFieldEnum[]
  }

  /**
   * TeamSelection findFirstOrThrow
   */
  export type TeamSelectionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * Filter, which TeamSelection to fetch.
     */
    where?: TeamSelectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamSelections to fetch.
     */
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TeamSelections.
     */
    cursor?: TeamSelectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamSelections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamSelections.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TeamSelections.
     */
    distinct?: TeamSelectionScalarFieldEnum | TeamSelectionScalarFieldEnum[]
  }

  /**
   * TeamSelection findMany
   */
  export type TeamSelectionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * Filter, which TeamSelections to fetch.
     */
    where?: TeamSelectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamSelections to fetch.
     */
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TeamSelections.
     */
    cursor?: TeamSelectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamSelections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamSelections.
     */
    skip?: number
    distinct?: TeamSelectionScalarFieldEnum | TeamSelectionScalarFieldEnum[]
  }

  /**
   * TeamSelection create
   */
  export type TeamSelectionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * The data needed to create a TeamSelection.
     */
    data: XOR<TeamSelectionCreateInput, TeamSelectionUncheckedCreateInput>
  }

  /**
   * TeamSelection createMany
   */
  export type TeamSelectionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TeamSelections.
     */
    data: TeamSelectionCreateManyInput | TeamSelectionCreateManyInput[]
  }

  /**
   * TeamSelection createManyAndReturn
   */
  export type TeamSelectionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * The data used to create many TeamSelections.
     */
    data: TeamSelectionCreateManyInput | TeamSelectionCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * TeamSelection update
   */
  export type TeamSelectionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * The data needed to update a TeamSelection.
     */
    data: XOR<TeamSelectionUpdateInput, TeamSelectionUncheckedUpdateInput>
    /**
     * Choose, which TeamSelection to update.
     */
    where: TeamSelectionWhereUniqueInput
  }

  /**
   * TeamSelection updateMany
   */
  export type TeamSelectionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TeamSelections.
     */
    data: XOR<TeamSelectionUpdateManyMutationInput, TeamSelectionUncheckedUpdateManyInput>
    /**
     * Filter which TeamSelections to update
     */
    where?: TeamSelectionWhereInput
    /**
     * Limit how many TeamSelections to update.
     */
    limit?: number
  }

  /**
   * TeamSelection updateManyAndReturn
   */
  export type TeamSelectionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * The data used to update TeamSelections.
     */
    data: XOR<TeamSelectionUpdateManyMutationInput, TeamSelectionUncheckedUpdateManyInput>
    /**
     * Filter which TeamSelections to update
     */
    where?: TeamSelectionWhereInput
    /**
     * Limit how many TeamSelections to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * TeamSelection upsert
   */
  export type TeamSelectionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * The filter to search for the TeamSelection to update in case it exists.
     */
    where: TeamSelectionWhereUniqueInput
    /**
     * In case the TeamSelection found by the `where` argument doesn't exist, create a new TeamSelection with this data.
     */
    create: XOR<TeamSelectionCreateInput, TeamSelectionUncheckedCreateInput>
    /**
     * In case the TeamSelection was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TeamSelectionUpdateInput, TeamSelectionUncheckedUpdateInput>
  }

  /**
   * TeamSelection delete
   */
  export type TeamSelectionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    /**
     * Filter which TeamSelection to delete.
     */
    where: TeamSelectionWhereUniqueInput
  }

  /**
   * TeamSelection deleteMany
   */
  export type TeamSelectionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TeamSelections to delete
     */
    where?: TeamSelectionWhereInput
    /**
     * Limit how many TeamSelections to delete.
     */
    limit?: number
  }

  /**
   * TeamSelection.teamRef
   */
  export type TeamSelection$teamRefArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    where?: TeamWhereInput
  }

  /**
   * TeamSelection without action
   */
  export type TeamSelectionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
  }


  /**
   * Model Team
   */

  export type AggregateTeam = {
    _count: TeamCountAggregateOutputType | null
    _min: TeamMinAggregateOutputType | null
    _max: TeamMaxAggregateOutputType | null
  }

  export type TeamMinAggregateOutputType = {
    id: string | null
    ownerId: string | null
    name: string | null
    roster: string | null
    createdAt: Date | null
  }

  export type TeamMaxAggregateOutputType = {
    id: string | null
    ownerId: string | null
    name: string | null
    roster: string | null
    createdAt: Date | null
  }

  export type TeamCountAggregateOutputType = {
    id: number
    ownerId: number
    name: number
    roster: number
    createdAt: number
    _all: number
  }


  export type TeamMinAggregateInputType = {
    id?: true
    ownerId?: true
    name?: true
    roster?: true
    createdAt?: true
  }

  export type TeamMaxAggregateInputType = {
    id?: true
    ownerId?: true
    name?: true
    roster?: true
    createdAt?: true
  }

  export type TeamCountAggregateInputType = {
    id?: true
    ownerId?: true
    name?: true
    roster?: true
    createdAt?: true
    _all?: true
  }

  export type TeamAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Team to aggregate.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Teams
    **/
    _count?: true | TeamCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TeamMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TeamMaxAggregateInputType
  }

  export type GetTeamAggregateType<T extends TeamAggregateArgs> = {
        [P in keyof T & keyof AggregateTeam]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTeam[P]>
      : GetScalarType<T[P], AggregateTeam[P]>
  }




  export type TeamGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamWhereInput
    orderBy?: TeamOrderByWithAggregationInput | TeamOrderByWithAggregationInput[]
    by: TeamScalarFieldEnum[] | TeamScalarFieldEnum
    having?: TeamScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TeamCountAggregateInputType | true
    _min?: TeamMinAggregateInputType
    _max?: TeamMaxAggregateInputType
  }

  export type TeamGroupByOutputType = {
    id: string
    ownerId: string
    name: string
    roster: string
    createdAt: Date
    _count: TeamCountAggregateOutputType | null
    _min: TeamMinAggregateOutputType | null
    _max: TeamMaxAggregateOutputType | null
  }

  type GetTeamGroupByPayload<T extends TeamGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TeamGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TeamGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TeamGroupByOutputType[P]>
            : GetScalarType<T[P], TeamGroupByOutputType[P]>
        }
      >
    >


  export type TeamSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
    owner?: boolean | UserDefaultArgs<ExtArgs>
    players?: boolean | Team$playersArgs<ExtArgs>
    selections?: boolean | Team$selectionsArgs<ExtArgs>
    _count?: boolean | TeamCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
    owner?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
    owner?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectScalar = {
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
  }

  export type TeamOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "ownerId" | "name" | "roster" | "createdAt", ExtArgs["result"]["team"]>
  export type TeamInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    owner?: boolean | UserDefaultArgs<ExtArgs>
    players?: boolean | Team$playersArgs<ExtArgs>
    selections?: boolean | Team$selectionsArgs<ExtArgs>
    _count?: boolean | TeamCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TeamIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    owner?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type TeamIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    owner?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $TeamPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Team"
    objects: {
      owner: Prisma.$UserPayload<ExtArgs>
      players: Prisma.$TeamPlayerPayload<ExtArgs>[]
      selections: Prisma.$TeamSelectionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      ownerId: string
      name: string
      roster: string
      createdAt: Date
    }, ExtArgs["result"]["team"]>
    composites: {}
  }

  type TeamGetPayload<S extends boolean | null | undefined | TeamDefaultArgs> = $Result.GetResult<Prisma.$TeamPayload, S>

  type TeamCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TeamFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TeamCountAggregateInputType | true
    }

  export interface TeamDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Team'], meta: { name: 'Team' } }
    /**
     * Find zero or one Team that matches the filter.
     * @param {TeamFindUniqueArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TeamFindUniqueArgs>(args: SelectSubset<T, TeamFindUniqueArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Team that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TeamFindUniqueOrThrowArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TeamFindUniqueOrThrowArgs>(args: SelectSubset<T, TeamFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Team that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamFindFirstArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TeamFindFirstArgs>(args?: SelectSubset<T, TeamFindFirstArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Team that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamFindFirstOrThrowArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TeamFindFirstOrThrowArgs>(args?: SelectSubset<T, TeamFindFirstOrThrowArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Teams that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Teams
     * const teams = await prisma.team.findMany()
     * 
     * // Get first 10 Teams
     * const teams = await prisma.team.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const teamWithIdOnly = await prisma.team.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TeamFindManyArgs>(args?: SelectSubset<T, TeamFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Team.
     * @param {TeamCreateArgs} args - Arguments to create a Team.
     * @example
     * // Create one Team
     * const Team = await prisma.team.create({
     *   data: {
     *     // ... data to create a Team
     *   }
     * })
     * 
     */
    create<T extends TeamCreateArgs>(args: SelectSubset<T, TeamCreateArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Teams.
     * @param {TeamCreateManyArgs} args - Arguments to create many Teams.
     * @example
     * // Create many Teams
     * const team = await prisma.team.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TeamCreateManyArgs>(args?: SelectSubset<T, TeamCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Teams and returns the data saved in the database.
     * @param {TeamCreateManyAndReturnArgs} args - Arguments to create many Teams.
     * @example
     * // Create many Teams
     * const team = await prisma.team.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Teams and only return the `id`
     * const teamWithIdOnly = await prisma.team.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TeamCreateManyAndReturnArgs>(args?: SelectSubset<T, TeamCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Team.
     * @param {TeamDeleteArgs} args - Arguments to delete one Team.
     * @example
     * // Delete one Team
     * const Team = await prisma.team.delete({
     *   where: {
     *     // ... filter to delete one Team
     *   }
     * })
     * 
     */
    delete<T extends TeamDeleteArgs>(args: SelectSubset<T, TeamDeleteArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Team.
     * @param {TeamUpdateArgs} args - Arguments to update one Team.
     * @example
     * // Update one Team
     * const team = await prisma.team.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TeamUpdateArgs>(args: SelectSubset<T, TeamUpdateArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Teams.
     * @param {TeamDeleteManyArgs} args - Arguments to filter Teams to delete.
     * @example
     * // Delete a few Teams
     * const { count } = await prisma.team.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TeamDeleteManyArgs>(args?: SelectSubset<T, TeamDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Teams.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Teams
     * const team = await prisma.team.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TeamUpdateManyArgs>(args: SelectSubset<T, TeamUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Teams and returns the data updated in the database.
     * @param {TeamUpdateManyAndReturnArgs} args - Arguments to update many Teams.
     * @example
     * // Update many Teams
     * const team = await prisma.team.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Teams and only return the `id`
     * const teamWithIdOnly = await prisma.team.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TeamUpdateManyAndReturnArgs>(args: SelectSubset<T, TeamUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Team.
     * @param {TeamUpsertArgs} args - Arguments to update or create a Team.
     * @example
     * // Update or create a Team
     * const team = await prisma.team.upsert({
     *   create: {
     *     // ... data to create a Team
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Team we want to update
     *   }
     * })
     */
    upsert<T extends TeamUpsertArgs>(args: SelectSubset<T, TeamUpsertArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Teams.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamCountArgs} args - Arguments to filter Teams to count.
     * @example
     * // Count the number of Teams
     * const count = await prisma.team.count({
     *   where: {
     *     // ... the filter for the Teams we want to count
     *   }
     * })
    **/
    count<T extends TeamCountArgs>(
      args?: Subset<T, TeamCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TeamCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Team.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TeamAggregateArgs>(args: Subset<T, TeamAggregateArgs>): Prisma.PrismaPromise<GetTeamAggregateType<T>>

    /**
     * Group by Team.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TeamGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TeamGroupByArgs['orderBy'] }
        : { orderBy?: TeamGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TeamGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTeamGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Team model
   */
  readonly fields: TeamFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Team.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TeamClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    owner<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    players<T extends Team$playersArgs<ExtArgs> = {}>(args?: Subset<T, Team$playersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    selections<T extends Team$selectionsArgs<ExtArgs> = {}>(args?: Subset<T, Team$selectionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamSelectionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Team model
   */
  interface TeamFieldRefs {
    readonly id: FieldRef<"Team", 'String'>
    readonly ownerId: FieldRef<"Team", 'String'>
    readonly name: FieldRef<"Team", 'String'>
    readonly roster: FieldRef<"Team", 'String'>
    readonly createdAt: FieldRef<"Team", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Team findUnique
   */
  export type TeamFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team findUniqueOrThrow
   */
  export type TeamFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team findFirst
   */
  export type TeamFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Teams.
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Teams.
     */
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Team findFirstOrThrow
   */
  export type TeamFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Teams.
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Teams.
     */
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Team findMany
   */
  export type TeamFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Teams to fetch.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Teams.
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Team create
   */
  export type TeamCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * The data needed to create a Team.
     */
    data: XOR<TeamCreateInput, TeamUncheckedCreateInput>
  }

  /**
   * Team createMany
   */
  export type TeamCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Teams.
     */
    data: TeamCreateManyInput | TeamCreateManyInput[]
  }

  /**
   * Team createManyAndReturn
   */
  export type TeamCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * The data used to create many Teams.
     */
    data: TeamCreateManyInput | TeamCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Team update
   */
  export type TeamUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * The data needed to update a Team.
     */
    data: XOR<TeamUpdateInput, TeamUncheckedUpdateInput>
    /**
     * Choose, which Team to update.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team updateMany
   */
  export type TeamUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Teams.
     */
    data: XOR<TeamUpdateManyMutationInput, TeamUncheckedUpdateManyInput>
    /**
     * Filter which Teams to update
     */
    where?: TeamWhereInput
    /**
     * Limit how many Teams to update.
     */
    limit?: number
  }

  /**
   * Team updateManyAndReturn
   */
  export type TeamUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * The data used to update Teams.
     */
    data: XOR<TeamUpdateManyMutationInput, TeamUncheckedUpdateManyInput>
    /**
     * Filter which Teams to update
     */
    where?: TeamWhereInput
    /**
     * Limit how many Teams to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Team upsert
   */
  export type TeamUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * The filter to search for the Team to update in case it exists.
     */
    where: TeamWhereUniqueInput
    /**
     * In case the Team found by the `where` argument doesn't exist, create a new Team with this data.
     */
    create: XOR<TeamCreateInput, TeamUncheckedCreateInput>
    /**
     * In case the Team was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TeamUpdateInput, TeamUncheckedUpdateInput>
  }

  /**
   * Team delete
   */
  export type TeamDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter which Team to delete.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team deleteMany
   */
  export type TeamDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Teams to delete
     */
    where?: TeamWhereInput
    /**
     * Limit how many Teams to delete.
     */
    limit?: number
  }

  /**
   * Team.players
   */
  export type Team$playersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    where?: TeamPlayerWhereInput
    orderBy?: TeamPlayerOrderByWithRelationInput | TeamPlayerOrderByWithRelationInput[]
    cursor?: TeamPlayerWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TeamPlayerScalarFieldEnum | TeamPlayerScalarFieldEnum[]
  }

  /**
   * Team.selections
   */
  export type Team$selectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamSelection
     */
    select?: TeamSelectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamSelection
     */
    omit?: TeamSelectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamSelectionInclude<ExtArgs> | null
    where?: TeamSelectionWhereInput
    orderBy?: TeamSelectionOrderByWithRelationInput | TeamSelectionOrderByWithRelationInput[]
    cursor?: TeamSelectionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TeamSelectionScalarFieldEnum | TeamSelectionScalarFieldEnum[]
  }

  /**
   * Team without action
   */
  export type TeamDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
  }


  /**
   * Model TeamPlayer
   */

  export type AggregateTeamPlayer = {
    _count: TeamPlayerCountAggregateOutputType | null
    _avg: TeamPlayerAvgAggregateOutputType | null
    _sum: TeamPlayerSumAggregateOutputType | null
    _min: TeamPlayerMinAggregateOutputType | null
    _max: TeamPlayerMaxAggregateOutputType | null
  }

  export type TeamPlayerAvgAggregateOutputType = {
    number: number | null
    ma: number | null
    st: number | null
    ag: number | null
    pa: number | null
    av: number | null
  }

  export type TeamPlayerSumAggregateOutputType = {
    number: number | null
    ma: number | null
    st: number | null
    ag: number | null
    pa: number | null
    av: number | null
  }

  export type TeamPlayerMinAggregateOutputType = {
    id: string | null
    teamId: string | null
    name: string | null
    position: string | null
    number: number | null
    ma: number | null
    st: number | null
    ag: number | null
    pa: number | null
    av: number | null
    skills: string | null
  }

  export type TeamPlayerMaxAggregateOutputType = {
    id: string | null
    teamId: string | null
    name: string | null
    position: string | null
    number: number | null
    ma: number | null
    st: number | null
    ag: number | null
    pa: number | null
    av: number | null
    skills: string | null
  }

  export type TeamPlayerCountAggregateOutputType = {
    id: number
    teamId: number
    name: number
    position: number
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: number
    _all: number
  }


  export type TeamPlayerAvgAggregateInputType = {
    number?: true
    ma?: true
    st?: true
    ag?: true
    pa?: true
    av?: true
  }

  export type TeamPlayerSumAggregateInputType = {
    number?: true
    ma?: true
    st?: true
    ag?: true
    pa?: true
    av?: true
  }

  export type TeamPlayerMinAggregateInputType = {
    id?: true
    teamId?: true
    name?: true
    position?: true
    number?: true
    ma?: true
    st?: true
    ag?: true
    pa?: true
    av?: true
    skills?: true
  }

  export type TeamPlayerMaxAggregateInputType = {
    id?: true
    teamId?: true
    name?: true
    position?: true
    number?: true
    ma?: true
    st?: true
    ag?: true
    pa?: true
    av?: true
    skills?: true
  }

  export type TeamPlayerCountAggregateInputType = {
    id?: true
    teamId?: true
    name?: true
    position?: true
    number?: true
    ma?: true
    st?: true
    ag?: true
    pa?: true
    av?: true
    skills?: true
    _all?: true
  }

  export type TeamPlayerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TeamPlayer to aggregate.
     */
    where?: TeamPlayerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamPlayers to fetch.
     */
    orderBy?: TeamPlayerOrderByWithRelationInput | TeamPlayerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TeamPlayerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamPlayers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamPlayers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TeamPlayers
    **/
    _count?: true | TeamPlayerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TeamPlayerAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TeamPlayerSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TeamPlayerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TeamPlayerMaxAggregateInputType
  }

  export type GetTeamPlayerAggregateType<T extends TeamPlayerAggregateArgs> = {
        [P in keyof T & keyof AggregateTeamPlayer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTeamPlayer[P]>
      : GetScalarType<T[P], AggregateTeamPlayer[P]>
  }




  export type TeamPlayerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamPlayerWhereInput
    orderBy?: TeamPlayerOrderByWithAggregationInput | TeamPlayerOrderByWithAggregationInput[]
    by: TeamPlayerScalarFieldEnum[] | TeamPlayerScalarFieldEnum
    having?: TeamPlayerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TeamPlayerCountAggregateInputType | true
    _avg?: TeamPlayerAvgAggregateInputType
    _sum?: TeamPlayerSumAggregateInputType
    _min?: TeamPlayerMinAggregateInputType
    _max?: TeamPlayerMaxAggregateInputType
  }

  export type TeamPlayerGroupByOutputType = {
    id: string
    teamId: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
    _count: TeamPlayerCountAggregateOutputType | null
    _avg: TeamPlayerAvgAggregateOutputType | null
    _sum: TeamPlayerSumAggregateOutputType | null
    _min: TeamPlayerMinAggregateOutputType | null
    _max: TeamPlayerMaxAggregateOutputType | null
  }

  type GetTeamPlayerGroupByPayload<T extends TeamPlayerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TeamPlayerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TeamPlayerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TeamPlayerGroupByOutputType[P]>
            : GetScalarType<T[P], TeamPlayerGroupByOutputType[P]>
        }
      >
    >


  export type TeamPlayerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    teamId?: boolean
    name?: boolean
    position?: boolean
    number?: boolean
    ma?: boolean
    st?: boolean
    ag?: boolean
    pa?: boolean
    av?: boolean
    skills?: boolean
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["teamPlayer"]>

  export type TeamPlayerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    teamId?: boolean
    name?: boolean
    position?: boolean
    number?: boolean
    ma?: boolean
    st?: boolean
    ag?: boolean
    pa?: boolean
    av?: boolean
    skills?: boolean
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["teamPlayer"]>

  export type TeamPlayerSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    teamId?: boolean
    name?: boolean
    position?: boolean
    number?: boolean
    ma?: boolean
    st?: boolean
    ag?: boolean
    pa?: boolean
    av?: boolean
    skills?: boolean
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["teamPlayer"]>

  export type TeamPlayerSelectScalar = {
    id?: boolean
    teamId?: boolean
    name?: boolean
    position?: boolean
    number?: boolean
    ma?: boolean
    st?: boolean
    ag?: boolean
    pa?: boolean
    av?: boolean
    skills?: boolean
  }

  export type TeamPlayerOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "teamId" | "name" | "position" | "number" | "ma" | "st" | "ag" | "pa" | "av" | "skills", ExtArgs["result"]["teamPlayer"]>
  export type TeamPlayerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }
  export type TeamPlayerIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }
  export type TeamPlayerIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }

  export type $TeamPlayerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TeamPlayer"
    objects: {
      team: Prisma.$TeamPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      teamId: string
      name: string
      position: string
      number: number
      ma: number
      st: number
      ag: number
      pa: number
      av: number
      skills: string
    }, ExtArgs["result"]["teamPlayer"]>
    composites: {}
  }

  type TeamPlayerGetPayload<S extends boolean | null | undefined | TeamPlayerDefaultArgs> = $Result.GetResult<Prisma.$TeamPlayerPayload, S>

  type TeamPlayerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TeamPlayerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TeamPlayerCountAggregateInputType | true
    }

  export interface TeamPlayerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TeamPlayer'], meta: { name: 'TeamPlayer' } }
    /**
     * Find zero or one TeamPlayer that matches the filter.
     * @param {TeamPlayerFindUniqueArgs} args - Arguments to find a TeamPlayer
     * @example
     * // Get one TeamPlayer
     * const teamPlayer = await prisma.teamPlayer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TeamPlayerFindUniqueArgs>(args: SelectSubset<T, TeamPlayerFindUniqueArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TeamPlayer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TeamPlayerFindUniqueOrThrowArgs} args - Arguments to find a TeamPlayer
     * @example
     * // Get one TeamPlayer
     * const teamPlayer = await prisma.teamPlayer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TeamPlayerFindUniqueOrThrowArgs>(args: SelectSubset<T, TeamPlayerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TeamPlayer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerFindFirstArgs} args - Arguments to find a TeamPlayer
     * @example
     * // Get one TeamPlayer
     * const teamPlayer = await prisma.teamPlayer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TeamPlayerFindFirstArgs>(args?: SelectSubset<T, TeamPlayerFindFirstArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TeamPlayer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerFindFirstOrThrowArgs} args - Arguments to find a TeamPlayer
     * @example
     * // Get one TeamPlayer
     * const teamPlayer = await prisma.teamPlayer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TeamPlayerFindFirstOrThrowArgs>(args?: SelectSubset<T, TeamPlayerFindFirstOrThrowArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TeamPlayers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TeamPlayers
     * const teamPlayers = await prisma.teamPlayer.findMany()
     * 
     * // Get first 10 TeamPlayers
     * const teamPlayers = await prisma.teamPlayer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const teamPlayerWithIdOnly = await prisma.teamPlayer.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TeamPlayerFindManyArgs>(args?: SelectSubset<T, TeamPlayerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TeamPlayer.
     * @param {TeamPlayerCreateArgs} args - Arguments to create a TeamPlayer.
     * @example
     * // Create one TeamPlayer
     * const TeamPlayer = await prisma.teamPlayer.create({
     *   data: {
     *     // ... data to create a TeamPlayer
     *   }
     * })
     * 
     */
    create<T extends TeamPlayerCreateArgs>(args: SelectSubset<T, TeamPlayerCreateArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TeamPlayers.
     * @param {TeamPlayerCreateManyArgs} args - Arguments to create many TeamPlayers.
     * @example
     * // Create many TeamPlayers
     * const teamPlayer = await prisma.teamPlayer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TeamPlayerCreateManyArgs>(args?: SelectSubset<T, TeamPlayerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TeamPlayers and returns the data saved in the database.
     * @param {TeamPlayerCreateManyAndReturnArgs} args - Arguments to create many TeamPlayers.
     * @example
     * // Create many TeamPlayers
     * const teamPlayer = await prisma.teamPlayer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TeamPlayers and only return the `id`
     * const teamPlayerWithIdOnly = await prisma.teamPlayer.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TeamPlayerCreateManyAndReturnArgs>(args?: SelectSubset<T, TeamPlayerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TeamPlayer.
     * @param {TeamPlayerDeleteArgs} args - Arguments to delete one TeamPlayer.
     * @example
     * // Delete one TeamPlayer
     * const TeamPlayer = await prisma.teamPlayer.delete({
     *   where: {
     *     // ... filter to delete one TeamPlayer
     *   }
     * })
     * 
     */
    delete<T extends TeamPlayerDeleteArgs>(args: SelectSubset<T, TeamPlayerDeleteArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TeamPlayer.
     * @param {TeamPlayerUpdateArgs} args - Arguments to update one TeamPlayer.
     * @example
     * // Update one TeamPlayer
     * const teamPlayer = await prisma.teamPlayer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TeamPlayerUpdateArgs>(args: SelectSubset<T, TeamPlayerUpdateArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TeamPlayers.
     * @param {TeamPlayerDeleteManyArgs} args - Arguments to filter TeamPlayers to delete.
     * @example
     * // Delete a few TeamPlayers
     * const { count } = await prisma.teamPlayer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TeamPlayerDeleteManyArgs>(args?: SelectSubset<T, TeamPlayerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TeamPlayers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TeamPlayers
     * const teamPlayer = await prisma.teamPlayer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TeamPlayerUpdateManyArgs>(args: SelectSubset<T, TeamPlayerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TeamPlayers and returns the data updated in the database.
     * @param {TeamPlayerUpdateManyAndReturnArgs} args - Arguments to update many TeamPlayers.
     * @example
     * // Update many TeamPlayers
     * const teamPlayer = await prisma.teamPlayer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TeamPlayers and only return the `id`
     * const teamPlayerWithIdOnly = await prisma.teamPlayer.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TeamPlayerUpdateManyAndReturnArgs>(args: SelectSubset<T, TeamPlayerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TeamPlayer.
     * @param {TeamPlayerUpsertArgs} args - Arguments to update or create a TeamPlayer.
     * @example
     * // Update or create a TeamPlayer
     * const teamPlayer = await prisma.teamPlayer.upsert({
     *   create: {
     *     // ... data to create a TeamPlayer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TeamPlayer we want to update
     *   }
     * })
     */
    upsert<T extends TeamPlayerUpsertArgs>(args: SelectSubset<T, TeamPlayerUpsertArgs<ExtArgs>>): Prisma__TeamPlayerClient<$Result.GetResult<Prisma.$TeamPlayerPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TeamPlayers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerCountArgs} args - Arguments to filter TeamPlayers to count.
     * @example
     * // Count the number of TeamPlayers
     * const count = await prisma.teamPlayer.count({
     *   where: {
     *     // ... the filter for the TeamPlayers we want to count
     *   }
     * })
    **/
    count<T extends TeamPlayerCountArgs>(
      args?: Subset<T, TeamPlayerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TeamPlayerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TeamPlayer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TeamPlayerAggregateArgs>(args: Subset<T, TeamPlayerAggregateArgs>): Prisma.PrismaPromise<GetTeamPlayerAggregateType<T>>

    /**
     * Group by TeamPlayer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamPlayerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TeamPlayerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TeamPlayerGroupByArgs['orderBy'] }
        : { orderBy?: TeamPlayerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TeamPlayerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTeamPlayerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TeamPlayer model
   */
  readonly fields: TeamPlayerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TeamPlayer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TeamPlayerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    team<T extends TeamDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TeamDefaultArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TeamPlayer model
   */
  interface TeamPlayerFieldRefs {
    readonly id: FieldRef<"TeamPlayer", 'String'>
    readonly teamId: FieldRef<"TeamPlayer", 'String'>
    readonly name: FieldRef<"TeamPlayer", 'String'>
    readonly position: FieldRef<"TeamPlayer", 'String'>
    readonly number: FieldRef<"TeamPlayer", 'Int'>
    readonly ma: FieldRef<"TeamPlayer", 'Int'>
    readonly st: FieldRef<"TeamPlayer", 'Int'>
    readonly ag: FieldRef<"TeamPlayer", 'Int'>
    readonly pa: FieldRef<"TeamPlayer", 'Int'>
    readonly av: FieldRef<"TeamPlayer", 'Int'>
    readonly skills: FieldRef<"TeamPlayer", 'String'>
  }
    

  // Custom InputTypes
  /**
   * TeamPlayer findUnique
   */
  export type TeamPlayerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * Filter, which TeamPlayer to fetch.
     */
    where: TeamPlayerWhereUniqueInput
  }

  /**
   * TeamPlayer findUniqueOrThrow
   */
  export type TeamPlayerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * Filter, which TeamPlayer to fetch.
     */
    where: TeamPlayerWhereUniqueInput
  }

  /**
   * TeamPlayer findFirst
   */
  export type TeamPlayerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * Filter, which TeamPlayer to fetch.
     */
    where?: TeamPlayerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamPlayers to fetch.
     */
    orderBy?: TeamPlayerOrderByWithRelationInput | TeamPlayerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TeamPlayers.
     */
    cursor?: TeamPlayerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamPlayers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamPlayers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TeamPlayers.
     */
    distinct?: TeamPlayerScalarFieldEnum | TeamPlayerScalarFieldEnum[]
  }

  /**
   * TeamPlayer findFirstOrThrow
   */
  export type TeamPlayerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * Filter, which TeamPlayer to fetch.
     */
    where?: TeamPlayerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamPlayers to fetch.
     */
    orderBy?: TeamPlayerOrderByWithRelationInput | TeamPlayerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TeamPlayers.
     */
    cursor?: TeamPlayerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamPlayers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamPlayers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TeamPlayers.
     */
    distinct?: TeamPlayerScalarFieldEnum | TeamPlayerScalarFieldEnum[]
  }

  /**
   * TeamPlayer findMany
   */
  export type TeamPlayerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * Filter, which TeamPlayers to fetch.
     */
    where?: TeamPlayerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TeamPlayers to fetch.
     */
    orderBy?: TeamPlayerOrderByWithRelationInput | TeamPlayerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TeamPlayers.
     */
    cursor?: TeamPlayerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TeamPlayers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TeamPlayers.
     */
    skip?: number
    distinct?: TeamPlayerScalarFieldEnum | TeamPlayerScalarFieldEnum[]
  }

  /**
   * TeamPlayer create
   */
  export type TeamPlayerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * The data needed to create a TeamPlayer.
     */
    data: XOR<TeamPlayerCreateInput, TeamPlayerUncheckedCreateInput>
  }

  /**
   * TeamPlayer createMany
   */
  export type TeamPlayerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TeamPlayers.
     */
    data: TeamPlayerCreateManyInput | TeamPlayerCreateManyInput[]
  }

  /**
   * TeamPlayer createManyAndReturn
   */
  export type TeamPlayerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * The data used to create many TeamPlayers.
     */
    data: TeamPlayerCreateManyInput | TeamPlayerCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * TeamPlayer update
   */
  export type TeamPlayerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * The data needed to update a TeamPlayer.
     */
    data: XOR<TeamPlayerUpdateInput, TeamPlayerUncheckedUpdateInput>
    /**
     * Choose, which TeamPlayer to update.
     */
    where: TeamPlayerWhereUniqueInput
  }

  /**
   * TeamPlayer updateMany
   */
  export type TeamPlayerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TeamPlayers.
     */
    data: XOR<TeamPlayerUpdateManyMutationInput, TeamPlayerUncheckedUpdateManyInput>
    /**
     * Filter which TeamPlayers to update
     */
    where?: TeamPlayerWhereInput
    /**
     * Limit how many TeamPlayers to update.
     */
    limit?: number
  }

  /**
   * TeamPlayer updateManyAndReturn
   */
  export type TeamPlayerUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * The data used to update TeamPlayers.
     */
    data: XOR<TeamPlayerUpdateManyMutationInput, TeamPlayerUncheckedUpdateManyInput>
    /**
     * Filter which TeamPlayers to update
     */
    where?: TeamPlayerWhereInput
    /**
     * Limit how many TeamPlayers to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * TeamPlayer upsert
   */
  export type TeamPlayerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * The filter to search for the TeamPlayer to update in case it exists.
     */
    where: TeamPlayerWhereUniqueInput
    /**
     * In case the TeamPlayer found by the `where` argument doesn't exist, create a new TeamPlayer with this data.
     */
    create: XOR<TeamPlayerCreateInput, TeamPlayerUncheckedCreateInput>
    /**
     * In case the TeamPlayer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TeamPlayerUpdateInput, TeamPlayerUncheckedUpdateInput>
  }

  /**
   * TeamPlayer delete
   */
  export type TeamPlayerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
    /**
     * Filter which TeamPlayer to delete.
     */
    where: TeamPlayerWhereUniqueInput
  }

  /**
   * TeamPlayer deleteMany
   */
  export type TeamPlayerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TeamPlayers to delete
     */
    where?: TeamPlayerWhereInput
    /**
     * Limit how many TeamPlayers to delete.
     */
    limit?: number
  }

  /**
   * TeamPlayer without action
   */
  export type TeamPlayerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamPlayer
     */
    select?: TeamPlayerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TeamPlayer
     */
    omit?: TeamPlayerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamPlayerInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    name: 'name',
    role: 'role',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const MatchScalarFieldEnum: {
    id: 'id',
    createdAt: 'createdAt',
    status: 'status',
    seed: 'seed',
    creatorId: 'creatorId'
  };

  export type MatchScalarFieldEnum = (typeof MatchScalarFieldEnum)[keyof typeof MatchScalarFieldEnum]


  export const TurnScalarFieldEnum: {
    id: 'id',
    matchId: 'matchId',
    number: 'number',
    payload: 'payload',
    createdAt: 'createdAt'
  };

  export type TurnScalarFieldEnum = (typeof TurnScalarFieldEnum)[keyof typeof TurnScalarFieldEnum]


  export const TeamSelectionScalarFieldEnum: {
    id: 'id',
    matchId: 'matchId',
    userId: 'userId',
    team: 'team',
    teamId: 'teamId',
    createdAt: 'createdAt'
  };

  export type TeamSelectionScalarFieldEnum = (typeof TeamSelectionScalarFieldEnum)[keyof typeof TeamSelectionScalarFieldEnum]


  export const TeamScalarFieldEnum: {
    id: 'id',
    ownerId: 'ownerId',
    name: 'name',
    roster: 'roster',
    createdAt: 'createdAt'
  };

  export type TeamScalarFieldEnum = (typeof TeamScalarFieldEnum)[keyof typeof TeamScalarFieldEnum]


  export const TeamPlayerScalarFieldEnum: {
    id: 'id',
    teamId: 'teamId',
    name: 'name',
    position: 'position',
    number: 'number',
    ma: 'ma',
    st: 'st',
    ag: 'ag',
    pa: 'pa',
    av: 'av',
    skills: 'skills'
  };

  export type TeamPlayerScalarFieldEnum = (typeof TeamPlayerScalarFieldEnum)[keyof typeof TeamPlayerScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    passwordHash?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    matches?: MatchListRelationFilter
    createdMatches?: MatchListRelationFilter
    teams?: TeamListRelationFilter
    teamSelections?: TeamSelectionListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrderInput | SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    matches?: MatchOrderByRelationAggregateInput
    createdMatches?: MatchOrderByRelationAggregateInput
    teams?: TeamOrderByRelationAggregateInput
    teamSelections?: TeamSelectionOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    passwordHash?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    matches?: MatchListRelationFilter
    createdMatches?: MatchListRelationFilter
    teams?: TeamListRelationFilter
    teamSelections?: TeamSelectionListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrderInput | SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    passwordHash?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    role?: StringWithAggregatesFilter<"User"> | string
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type MatchWhereInput = {
    AND?: MatchWhereInput | MatchWhereInput[]
    OR?: MatchWhereInput[]
    NOT?: MatchWhereInput | MatchWhereInput[]
    id?: StringFilter<"Match"> | string
    createdAt?: DateTimeFilter<"Match"> | Date | string
    status?: StringFilter<"Match"> | string
    seed?: StringFilter<"Match"> | string
    creatorId?: StringNullableFilter<"Match"> | string | null
    creator?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    players?: UserListRelationFilter
    turns?: TurnListRelationFilter
    teamSelections?: TeamSelectionListRelationFilter
  }

  export type MatchOrderByWithRelationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    creatorId?: SortOrderInput | SortOrder
    creator?: UserOrderByWithRelationInput
    players?: UserOrderByRelationAggregateInput
    turns?: TurnOrderByRelationAggregateInput
    teamSelections?: TeamSelectionOrderByRelationAggregateInput
  }

  export type MatchWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MatchWhereInput | MatchWhereInput[]
    OR?: MatchWhereInput[]
    NOT?: MatchWhereInput | MatchWhereInput[]
    createdAt?: DateTimeFilter<"Match"> | Date | string
    status?: StringFilter<"Match"> | string
    seed?: StringFilter<"Match"> | string
    creatorId?: StringNullableFilter<"Match"> | string | null
    creator?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    players?: UserListRelationFilter
    turns?: TurnListRelationFilter
    teamSelections?: TeamSelectionListRelationFilter
  }, "id">

  export type MatchOrderByWithAggregationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    creatorId?: SortOrderInput | SortOrder
    _count?: MatchCountOrderByAggregateInput
    _max?: MatchMaxOrderByAggregateInput
    _min?: MatchMinOrderByAggregateInput
  }

  export type MatchScalarWhereWithAggregatesInput = {
    AND?: MatchScalarWhereWithAggregatesInput | MatchScalarWhereWithAggregatesInput[]
    OR?: MatchScalarWhereWithAggregatesInput[]
    NOT?: MatchScalarWhereWithAggregatesInput | MatchScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Match"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Match"> | Date | string
    status?: StringWithAggregatesFilter<"Match"> | string
    seed?: StringWithAggregatesFilter<"Match"> | string
    creatorId?: StringNullableWithAggregatesFilter<"Match"> | string | null
  }

  export type TurnWhereInput = {
    AND?: TurnWhereInput | TurnWhereInput[]
    OR?: TurnWhereInput[]
    NOT?: TurnWhereInput | TurnWhereInput[]
    id?: StringFilter<"Turn"> | string
    matchId?: StringFilter<"Turn"> | string
    number?: IntFilter<"Turn"> | number
    payload?: JsonFilter<"Turn">
    createdAt?: DateTimeFilter<"Turn"> | Date | string
    match?: XOR<MatchScalarRelationFilter, MatchWhereInput>
  }

  export type TurnOrderByWithRelationInput = {
    id?: SortOrder
    matchId?: SortOrder
    number?: SortOrder
    payload?: SortOrder
    createdAt?: SortOrder
    match?: MatchOrderByWithRelationInput
  }

  export type TurnWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TurnWhereInput | TurnWhereInput[]
    OR?: TurnWhereInput[]
    NOT?: TurnWhereInput | TurnWhereInput[]
    matchId?: StringFilter<"Turn"> | string
    number?: IntFilter<"Turn"> | number
    payload?: JsonFilter<"Turn">
    createdAt?: DateTimeFilter<"Turn"> | Date | string
    match?: XOR<MatchScalarRelationFilter, MatchWhereInput>
  }, "id">

  export type TurnOrderByWithAggregationInput = {
    id?: SortOrder
    matchId?: SortOrder
    number?: SortOrder
    payload?: SortOrder
    createdAt?: SortOrder
    _count?: TurnCountOrderByAggregateInput
    _avg?: TurnAvgOrderByAggregateInput
    _max?: TurnMaxOrderByAggregateInput
    _min?: TurnMinOrderByAggregateInput
    _sum?: TurnSumOrderByAggregateInput
  }

  export type TurnScalarWhereWithAggregatesInput = {
    AND?: TurnScalarWhereWithAggregatesInput | TurnScalarWhereWithAggregatesInput[]
    OR?: TurnScalarWhereWithAggregatesInput[]
    NOT?: TurnScalarWhereWithAggregatesInput | TurnScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Turn"> | string
    matchId?: StringWithAggregatesFilter<"Turn"> | string
    number?: IntWithAggregatesFilter<"Turn"> | number
    payload?: JsonWithAggregatesFilter<"Turn">
    createdAt?: DateTimeWithAggregatesFilter<"Turn"> | Date | string
  }

  export type TeamSelectionWhereInput = {
    AND?: TeamSelectionWhereInput | TeamSelectionWhereInput[]
    OR?: TeamSelectionWhereInput[]
    NOT?: TeamSelectionWhereInput | TeamSelectionWhereInput[]
    id?: StringFilter<"TeamSelection"> | string
    matchId?: StringFilter<"TeamSelection"> | string
    userId?: StringFilter<"TeamSelection"> | string
    team?: StringFilter<"TeamSelection"> | string
    teamId?: StringNullableFilter<"TeamSelection"> | string | null
    createdAt?: DateTimeFilter<"TeamSelection"> | Date | string
    match?: XOR<MatchScalarRelationFilter, MatchWhereInput>
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    teamRef?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
  }

  export type TeamSelectionOrderByWithRelationInput = {
    id?: SortOrder
    matchId?: SortOrder
    userId?: SortOrder
    team?: SortOrder
    teamId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    match?: MatchOrderByWithRelationInput
    user?: UserOrderByWithRelationInput
    teamRef?: TeamOrderByWithRelationInput
  }

  export type TeamSelectionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    matchId_userId?: TeamSelectionMatchIdUserIdCompoundUniqueInput
    matchId_team?: TeamSelectionMatchIdTeamCompoundUniqueInput
    matchId_teamId?: TeamSelectionMatchIdTeamIdCompoundUniqueInput
    AND?: TeamSelectionWhereInput | TeamSelectionWhereInput[]
    OR?: TeamSelectionWhereInput[]
    NOT?: TeamSelectionWhereInput | TeamSelectionWhereInput[]
    matchId?: StringFilter<"TeamSelection"> | string
    userId?: StringFilter<"TeamSelection"> | string
    team?: StringFilter<"TeamSelection"> | string
    teamId?: StringNullableFilter<"TeamSelection"> | string | null
    createdAt?: DateTimeFilter<"TeamSelection"> | Date | string
    match?: XOR<MatchScalarRelationFilter, MatchWhereInput>
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    teamRef?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
  }, "id" | "matchId_userId" | "matchId_team" | "matchId_teamId">

  export type TeamSelectionOrderByWithAggregationInput = {
    id?: SortOrder
    matchId?: SortOrder
    userId?: SortOrder
    team?: SortOrder
    teamId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: TeamSelectionCountOrderByAggregateInput
    _max?: TeamSelectionMaxOrderByAggregateInput
    _min?: TeamSelectionMinOrderByAggregateInput
  }

  export type TeamSelectionScalarWhereWithAggregatesInput = {
    AND?: TeamSelectionScalarWhereWithAggregatesInput | TeamSelectionScalarWhereWithAggregatesInput[]
    OR?: TeamSelectionScalarWhereWithAggregatesInput[]
    NOT?: TeamSelectionScalarWhereWithAggregatesInput | TeamSelectionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TeamSelection"> | string
    matchId?: StringWithAggregatesFilter<"TeamSelection"> | string
    userId?: StringWithAggregatesFilter<"TeamSelection"> | string
    team?: StringWithAggregatesFilter<"TeamSelection"> | string
    teamId?: StringNullableWithAggregatesFilter<"TeamSelection"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TeamSelection"> | Date | string
  }

  export type TeamWhereInput = {
    AND?: TeamWhereInput | TeamWhereInput[]
    OR?: TeamWhereInput[]
    NOT?: TeamWhereInput | TeamWhereInput[]
    id?: StringFilter<"Team"> | string
    ownerId?: StringFilter<"Team"> | string
    name?: StringFilter<"Team"> | string
    roster?: StringFilter<"Team"> | string
    createdAt?: DateTimeFilter<"Team"> | Date | string
    owner?: XOR<UserScalarRelationFilter, UserWhereInput>
    players?: TeamPlayerListRelationFilter
    selections?: TeamSelectionListRelationFilter
  }

  export type TeamOrderByWithRelationInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    owner?: UserOrderByWithRelationInput
    players?: TeamPlayerOrderByRelationAggregateInput
    selections?: TeamSelectionOrderByRelationAggregateInput
  }

  export type TeamWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TeamWhereInput | TeamWhereInput[]
    OR?: TeamWhereInput[]
    NOT?: TeamWhereInput | TeamWhereInput[]
    ownerId?: StringFilter<"Team"> | string
    name?: StringFilter<"Team"> | string
    roster?: StringFilter<"Team"> | string
    createdAt?: DateTimeFilter<"Team"> | Date | string
    owner?: XOR<UserScalarRelationFilter, UserWhereInput>
    players?: TeamPlayerListRelationFilter
    selections?: TeamSelectionListRelationFilter
  }, "id">

  export type TeamOrderByWithAggregationInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    _count?: TeamCountOrderByAggregateInput
    _max?: TeamMaxOrderByAggregateInput
    _min?: TeamMinOrderByAggregateInput
  }

  export type TeamScalarWhereWithAggregatesInput = {
    AND?: TeamScalarWhereWithAggregatesInput | TeamScalarWhereWithAggregatesInput[]
    OR?: TeamScalarWhereWithAggregatesInput[]
    NOT?: TeamScalarWhereWithAggregatesInput | TeamScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Team"> | string
    ownerId?: StringWithAggregatesFilter<"Team"> | string
    name?: StringWithAggregatesFilter<"Team"> | string
    roster?: StringWithAggregatesFilter<"Team"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Team"> | Date | string
  }

  export type TeamPlayerWhereInput = {
    AND?: TeamPlayerWhereInput | TeamPlayerWhereInput[]
    OR?: TeamPlayerWhereInput[]
    NOT?: TeamPlayerWhereInput | TeamPlayerWhereInput[]
    id?: StringFilter<"TeamPlayer"> | string
    teamId?: StringFilter<"TeamPlayer"> | string
    name?: StringFilter<"TeamPlayer"> | string
    position?: StringFilter<"TeamPlayer"> | string
    number?: IntFilter<"TeamPlayer"> | number
    ma?: IntFilter<"TeamPlayer"> | number
    st?: IntFilter<"TeamPlayer"> | number
    ag?: IntFilter<"TeamPlayer"> | number
    pa?: IntFilter<"TeamPlayer"> | number
    av?: IntFilter<"TeamPlayer"> | number
    skills?: StringFilter<"TeamPlayer"> | string
    team?: XOR<TeamScalarRelationFilter, TeamWhereInput>
  }

  export type TeamPlayerOrderByWithRelationInput = {
    id?: SortOrder
    teamId?: SortOrder
    name?: SortOrder
    position?: SortOrder
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
    skills?: SortOrder
    team?: TeamOrderByWithRelationInput
  }

  export type TeamPlayerWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TeamPlayerWhereInput | TeamPlayerWhereInput[]
    OR?: TeamPlayerWhereInput[]
    NOT?: TeamPlayerWhereInput | TeamPlayerWhereInput[]
    teamId?: StringFilter<"TeamPlayer"> | string
    name?: StringFilter<"TeamPlayer"> | string
    position?: StringFilter<"TeamPlayer"> | string
    number?: IntFilter<"TeamPlayer"> | number
    ma?: IntFilter<"TeamPlayer"> | number
    st?: IntFilter<"TeamPlayer"> | number
    ag?: IntFilter<"TeamPlayer"> | number
    pa?: IntFilter<"TeamPlayer"> | number
    av?: IntFilter<"TeamPlayer"> | number
    skills?: StringFilter<"TeamPlayer"> | string
    team?: XOR<TeamScalarRelationFilter, TeamWhereInput>
  }, "id">

  export type TeamPlayerOrderByWithAggregationInput = {
    id?: SortOrder
    teamId?: SortOrder
    name?: SortOrder
    position?: SortOrder
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
    skills?: SortOrder
    _count?: TeamPlayerCountOrderByAggregateInput
    _avg?: TeamPlayerAvgOrderByAggregateInput
    _max?: TeamPlayerMaxOrderByAggregateInput
    _min?: TeamPlayerMinOrderByAggregateInput
    _sum?: TeamPlayerSumOrderByAggregateInput
  }

  export type TeamPlayerScalarWhereWithAggregatesInput = {
    AND?: TeamPlayerScalarWhereWithAggregatesInput | TeamPlayerScalarWhereWithAggregatesInput[]
    OR?: TeamPlayerScalarWhereWithAggregatesInput[]
    NOT?: TeamPlayerScalarWhereWithAggregatesInput | TeamPlayerScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TeamPlayer"> | string
    teamId?: StringWithAggregatesFilter<"TeamPlayer"> | string
    name?: StringWithAggregatesFilter<"TeamPlayer"> | string
    position?: StringWithAggregatesFilter<"TeamPlayer"> | string
    number?: IntWithAggregatesFilter<"TeamPlayer"> | number
    ma?: IntWithAggregatesFilter<"TeamPlayer"> | number
    st?: IntWithAggregatesFilter<"TeamPlayer"> | number
    ag?: IntWithAggregatesFilter<"TeamPlayer"> | number
    pa?: IntWithAggregatesFilter<"TeamPlayer"> | number
    av?: IntWithAggregatesFilter<"TeamPlayer"> | number
    skills?: StringWithAggregatesFilter<"TeamPlayer"> | string
  }

  export type UserCreateInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MatchCreateInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creator?: UserCreateNestedOneWithoutCreatedMatchesInput
    players?: UserCreateNestedManyWithoutMatchesInput
    turns?: TurnCreateNestedManyWithoutMatchInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutMatchInput
  }

  export type MatchUncheckedCreateInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creatorId?: string | null
    players?: UserUncheckedCreateNestedManyWithoutMatchesInput
    turns?: TurnUncheckedCreateNestedManyWithoutMatchInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type MatchUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creator?: UserUpdateOneWithoutCreatedMatchesNestedInput
    players?: UserUpdateManyWithoutMatchesNestedInput
    turns?: TurnUpdateManyWithoutMatchNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creatorId?: NullableStringFieldUpdateOperationsInput | string | null
    players?: UserUncheckedUpdateManyWithoutMatchesNestedInput
    turns?: TurnUncheckedUpdateManyWithoutMatchNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type MatchCreateManyInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creatorId?: string | null
  }

  export type MatchUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
  }

  export type MatchUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creatorId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TurnCreateInput = {
    id?: string
    number: number
    payload: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTurnsInput
  }

  export type TurnUncheckedCreateInput = {
    id?: string
    matchId: string
    number: number
    payload: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type TurnUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTurnsNestedInput
  }

  export type TurnUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TurnCreateManyInput = {
    id?: string
    matchId: string
    number: number
    payload: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type TurnUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TurnUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionCreateInput = {
    id?: string
    team?: string
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTeamSelectionsInput
    user: UserCreateNestedOneWithoutTeamSelectionsInput
    teamRef?: TeamCreateNestedOneWithoutSelectionsInput
  }

  export type TeamSelectionUncheckedCreateInput = {
    id?: string
    matchId: string
    userId: string
    team?: string
    teamId?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput
    user?: UserUpdateOneRequiredWithoutTeamSelectionsNestedInput
    teamRef?: TeamUpdateOneWithoutSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionCreateManyInput = {
    id?: string
    matchId: string
    userId: string
    team?: string
    teamId?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamCreateInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
  }

  export type TeamUncheckedCreateInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
  }

  export type TeamUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
  }

  export type TeamUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
  }

  export type TeamCreateManyInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
  }

  export type TeamUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamPlayerCreateInput = {
    id?: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
    team: TeamCreateNestedOneWithoutPlayersInput
  }

  export type TeamPlayerUncheckedCreateInput = {
    id?: string
    teamId: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
  }

  export type TeamPlayerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
    team?: TeamUpdateOneRequiredWithoutPlayersNestedInput
  }

  export type TeamPlayerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    teamId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
  }

  export type TeamPlayerCreateManyInput = {
    id?: string
    teamId: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
  }

  export type TeamPlayerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
  }

  export type TeamPlayerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    teamId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type MatchListRelationFilter = {
    every?: MatchWhereInput
    some?: MatchWhereInput
    none?: MatchWhereInput
  }

  export type TeamListRelationFilter = {
    every?: TeamWhereInput
    some?: TeamWhereInput
    none?: TeamWhereInput
  }

  export type TeamSelectionListRelationFilter = {
    every?: TeamSelectionWhereInput
    some?: TeamSelectionWhereInput
    none?: TeamSelectionWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type MatchOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TeamOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TeamSelectionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type UserListRelationFilter = {
    every?: UserWhereInput
    some?: UserWhereInput
    none?: UserWhereInput
  }

  export type TurnListRelationFilter = {
    every?: TurnWhereInput
    some?: TurnWhereInput
    none?: TurnWhereInput
  }

  export type UserOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TurnOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type MatchCountOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    creatorId?: SortOrder
  }

  export type MatchMaxOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    creatorId?: SortOrder
  }

  export type MatchMinOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    creatorId?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type MatchScalarRelationFilter = {
    is?: MatchWhereInput
    isNot?: MatchWhereInput
  }

  export type TurnCountOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    number?: SortOrder
    payload?: SortOrder
    createdAt?: SortOrder
  }

  export type TurnAvgOrderByAggregateInput = {
    number?: SortOrder
  }

  export type TurnMaxOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    number?: SortOrder
    createdAt?: SortOrder
  }

  export type TurnMinOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    number?: SortOrder
    createdAt?: SortOrder
  }

  export type TurnSumOrderByAggregateInput = {
    number?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type TeamNullableScalarRelationFilter = {
    is?: TeamWhereInput | null
    isNot?: TeamWhereInput | null
  }

  export type TeamSelectionMatchIdUserIdCompoundUniqueInput = {
    matchId: string
    userId: string
  }

  export type TeamSelectionMatchIdTeamCompoundUniqueInput = {
    matchId: string
    team: string
  }

  export type TeamSelectionMatchIdTeamIdCompoundUniqueInput = {
    matchId: string
    teamId: string
  }

  export type TeamSelectionCountOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    userId?: SortOrder
    team?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
  }

  export type TeamSelectionMaxOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    userId?: SortOrder
    team?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
  }

  export type TeamSelectionMinOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    userId?: SortOrder
    team?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
  }

  export type TeamPlayerListRelationFilter = {
    every?: TeamPlayerWhereInput
    some?: TeamPlayerWhereInput
    none?: TeamPlayerWhereInput
  }

  export type TeamPlayerOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TeamCountOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
  }

  export type TeamMaxOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
  }

  export type TeamMinOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
  }

  export type TeamScalarRelationFilter = {
    is?: TeamWhereInput
    isNot?: TeamWhereInput
  }

  export type TeamPlayerCountOrderByAggregateInput = {
    id?: SortOrder
    teamId?: SortOrder
    name?: SortOrder
    position?: SortOrder
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
    skills?: SortOrder
  }

  export type TeamPlayerAvgOrderByAggregateInput = {
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
  }

  export type TeamPlayerMaxOrderByAggregateInput = {
    id?: SortOrder
    teamId?: SortOrder
    name?: SortOrder
    position?: SortOrder
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
    skills?: SortOrder
  }

  export type TeamPlayerMinOrderByAggregateInput = {
    id?: SortOrder
    teamId?: SortOrder
    name?: SortOrder
    position?: SortOrder
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
    skills?: SortOrder
  }

  export type TeamPlayerSumOrderByAggregateInput = {
    number?: SortOrder
    ma?: SortOrder
    st?: SortOrder
    ag?: SortOrder
    pa?: SortOrder
    av?: SortOrder
  }

  export type MatchCreateNestedManyWithoutPlayersInput = {
    create?: XOR<MatchCreateWithoutPlayersInput, MatchUncheckedCreateWithoutPlayersInput> | MatchCreateWithoutPlayersInput[] | MatchUncheckedCreateWithoutPlayersInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutPlayersInput | MatchCreateOrConnectWithoutPlayersInput[]
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
  }

  export type MatchCreateNestedManyWithoutCreatorInput = {
    create?: XOR<MatchCreateWithoutCreatorInput, MatchUncheckedCreateWithoutCreatorInput> | MatchCreateWithoutCreatorInput[] | MatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutCreatorInput | MatchCreateOrConnectWithoutCreatorInput[]
    createMany?: MatchCreateManyCreatorInputEnvelope
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
  }

  export type TeamCreateNestedManyWithoutOwnerInput = {
    create?: XOR<TeamCreateWithoutOwnerInput, TeamUncheckedCreateWithoutOwnerInput> | TeamCreateWithoutOwnerInput[] | TeamUncheckedCreateWithoutOwnerInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutOwnerInput | TeamCreateOrConnectWithoutOwnerInput[]
    createMany?: TeamCreateManyOwnerInputEnvelope
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
  }

  export type TeamSelectionCreateNestedManyWithoutUserInput = {
    create?: XOR<TeamSelectionCreateWithoutUserInput, TeamSelectionUncheckedCreateWithoutUserInput> | TeamSelectionCreateWithoutUserInput[] | TeamSelectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutUserInput | TeamSelectionCreateOrConnectWithoutUserInput[]
    createMany?: TeamSelectionCreateManyUserInputEnvelope
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
  }

  export type MatchUncheckedCreateNestedManyWithoutPlayersInput = {
    create?: XOR<MatchCreateWithoutPlayersInput, MatchUncheckedCreateWithoutPlayersInput> | MatchCreateWithoutPlayersInput[] | MatchUncheckedCreateWithoutPlayersInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutPlayersInput | MatchCreateOrConnectWithoutPlayersInput[]
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
  }

  export type MatchUncheckedCreateNestedManyWithoutCreatorInput = {
    create?: XOR<MatchCreateWithoutCreatorInput, MatchUncheckedCreateWithoutCreatorInput> | MatchCreateWithoutCreatorInput[] | MatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutCreatorInput | MatchCreateOrConnectWithoutCreatorInput[]
    createMany?: MatchCreateManyCreatorInputEnvelope
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
  }

  export type TeamUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<TeamCreateWithoutOwnerInput, TeamUncheckedCreateWithoutOwnerInput> | TeamCreateWithoutOwnerInput[] | TeamUncheckedCreateWithoutOwnerInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutOwnerInput | TeamCreateOrConnectWithoutOwnerInput[]
    createMany?: TeamCreateManyOwnerInputEnvelope
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
  }

  export type TeamSelectionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<TeamSelectionCreateWithoutUserInput, TeamSelectionUncheckedCreateWithoutUserInput> | TeamSelectionCreateWithoutUserInput[] | TeamSelectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutUserInput | TeamSelectionCreateOrConnectWithoutUserInput[]
    createMany?: TeamSelectionCreateManyUserInputEnvelope
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type MatchUpdateManyWithoutPlayersNestedInput = {
    create?: XOR<MatchCreateWithoutPlayersInput, MatchUncheckedCreateWithoutPlayersInput> | MatchCreateWithoutPlayersInput[] | MatchUncheckedCreateWithoutPlayersInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutPlayersInput | MatchCreateOrConnectWithoutPlayersInput[]
    upsert?: MatchUpsertWithWhereUniqueWithoutPlayersInput | MatchUpsertWithWhereUniqueWithoutPlayersInput[]
    set?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    disconnect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    delete?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    update?: MatchUpdateWithWhereUniqueWithoutPlayersInput | MatchUpdateWithWhereUniqueWithoutPlayersInput[]
    updateMany?: MatchUpdateManyWithWhereWithoutPlayersInput | MatchUpdateManyWithWhereWithoutPlayersInput[]
    deleteMany?: MatchScalarWhereInput | MatchScalarWhereInput[]
  }

  export type MatchUpdateManyWithoutCreatorNestedInput = {
    create?: XOR<MatchCreateWithoutCreatorInput, MatchUncheckedCreateWithoutCreatorInput> | MatchCreateWithoutCreatorInput[] | MatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutCreatorInput | MatchCreateOrConnectWithoutCreatorInput[]
    upsert?: MatchUpsertWithWhereUniqueWithoutCreatorInput | MatchUpsertWithWhereUniqueWithoutCreatorInput[]
    createMany?: MatchCreateManyCreatorInputEnvelope
    set?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    disconnect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    delete?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    update?: MatchUpdateWithWhereUniqueWithoutCreatorInput | MatchUpdateWithWhereUniqueWithoutCreatorInput[]
    updateMany?: MatchUpdateManyWithWhereWithoutCreatorInput | MatchUpdateManyWithWhereWithoutCreatorInput[]
    deleteMany?: MatchScalarWhereInput | MatchScalarWhereInput[]
  }

  export type TeamUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<TeamCreateWithoutOwnerInput, TeamUncheckedCreateWithoutOwnerInput> | TeamCreateWithoutOwnerInput[] | TeamUncheckedCreateWithoutOwnerInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutOwnerInput | TeamCreateOrConnectWithoutOwnerInput[]
    upsert?: TeamUpsertWithWhereUniqueWithoutOwnerInput | TeamUpsertWithWhereUniqueWithoutOwnerInput[]
    createMany?: TeamCreateManyOwnerInputEnvelope
    set?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    disconnect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    delete?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    update?: TeamUpdateWithWhereUniqueWithoutOwnerInput | TeamUpdateWithWhereUniqueWithoutOwnerInput[]
    updateMany?: TeamUpdateManyWithWhereWithoutOwnerInput | TeamUpdateManyWithWhereWithoutOwnerInput[]
    deleteMany?: TeamScalarWhereInput | TeamScalarWhereInput[]
  }

  export type TeamSelectionUpdateManyWithoutUserNestedInput = {
    create?: XOR<TeamSelectionCreateWithoutUserInput, TeamSelectionUncheckedCreateWithoutUserInput> | TeamSelectionCreateWithoutUserInput[] | TeamSelectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutUserInput | TeamSelectionCreateOrConnectWithoutUserInput[]
    upsert?: TeamSelectionUpsertWithWhereUniqueWithoutUserInput | TeamSelectionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: TeamSelectionCreateManyUserInputEnvelope
    set?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    disconnect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    delete?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    update?: TeamSelectionUpdateWithWhereUniqueWithoutUserInput | TeamSelectionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: TeamSelectionUpdateManyWithWhereWithoutUserInput | TeamSelectionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
  }

  export type MatchUncheckedUpdateManyWithoutPlayersNestedInput = {
    create?: XOR<MatchCreateWithoutPlayersInput, MatchUncheckedCreateWithoutPlayersInput> | MatchCreateWithoutPlayersInput[] | MatchUncheckedCreateWithoutPlayersInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutPlayersInput | MatchCreateOrConnectWithoutPlayersInput[]
    upsert?: MatchUpsertWithWhereUniqueWithoutPlayersInput | MatchUpsertWithWhereUniqueWithoutPlayersInput[]
    set?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    disconnect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    delete?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    update?: MatchUpdateWithWhereUniqueWithoutPlayersInput | MatchUpdateWithWhereUniqueWithoutPlayersInput[]
    updateMany?: MatchUpdateManyWithWhereWithoutPlayersInput | MatchUpdateManyWithWhereWithoutPlayersInput[]
    deleteMany?: MatchScalarWhereInput | MatchScalarWhereInput[]
  }

  export type MatchUncheckedUpdateManyWithoutCreatorNestedInput = {
    create?: XOR<MatchCreateWithoutCreatorInput, MatchUncheckedCreateWithoutCreatorInput> | MatchCreateWithoutCreatorInput[] | MatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: MatchCreateOrConnectWithoutCreatorInput | MatchCreateOrConnectWithoutCreatorInput[]
    upsert?: MatchUpsertWithWhereUniqueWithoutCreatorInput | MatchUpsertWithWhereUniqueWithoutCreatorInput[]
    createMany?: MatchCreateManyCreatorInputEnvelope
    set?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    disconnect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    delete?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    connect?: MatchWhereUniqueInput | MatchWhereUniqueInput[]
    update?: MatchUpdateWithWhereUniqueWithoutCreatorInput | MatchUpdateWithWhereUniqueWithoutCreatorInput[]
    updateMany?: MatchUpdateManyWithWhereWithoutCreatorInput | MatchUpdateManyWithWhereWithoutCreatorInput[]
    deleteMany?: MatchScalarWhereInput | MatchScalarWhereInput[]
  }

  export type TeamUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<TeamCreateWithoutOwnerInput, TeamUncheckedCreateWithoutOwnerInput> | TeamCreateWithoutOwnerInput[] | TeamUncheckedCreateWithoutOwnerInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutOwnerInput | TeamCreateOrConnectWithoutOwnerInput[]
    upsert?: TeamUpsertWithWhereUniqueWithoutOwnerInput | TeamUpsertWithWhereUniqueWithoutOwnerInput[]
    createMany?: TeamCreateManyOwnerInputEnvelope
    set?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    disconnect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    delete?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    update?: TeamUpdateWithWhereUniqueWithoutOwnerInput | TeamUpdateWithWhereUniqueWithoutOwnerInput[]
    updateMany?: TeamUpdateManyWithWhereWithoutOwnerInput | TeamUpdateManyWithWhereWithoutOwnerInput[]
    deleteMany?: TeamScalarWhereInput | TeamScalarWhereInput[]
  }

  export type TeamSelectionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<TeamSelectionCreateWithoutUserInput, TeamSelectionUncheckedCreateWithoutUserInput> | TeamSelectionCreateWithoutUserInput[] | TeamSelectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutUserInput | TeamSelectionCreateOrConnectWithoutUserInput[]
    upsert?: TeamSelectionUpsertWithWhereUniqueWithoutUserInput | TeamSelectionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: TeamSelectionCreateManyUserInputEnvelope
    set?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    disconnect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    delete?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    update?: TeamSelectionUpdateWithWhereUniqueWithoutUserInput | TeamSelectionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: TeamSelectionUpdateManyWithWhereWithoutUserInput | TeamSelectionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutCreatedMatchesInput = {
    create?: XOR<UserCreateWithoutCreatedMatchesInput, UserUncheckedCreateWithoutCreatedMatchesInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedMatchesInput
    connect?: UserWhereUniqueInput
  }

  export type UserCreateNestedManyWithoutMatchesInput = {
    create?: XOR<UserCreateWithoutMatchesInput, UserUncheckedCreateWithoutMatchesInput> | UserCreateWithoutMatchesInput[] | UserUncheckedCreateWithoutMatchesInput[]
    connectOrCreate?: UserCreateOrConnectWithoutMatchesInput | UserCreateOrConnectWithoutMatchesInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type TurnCreateNestedManyWithoutMatchInput = {
    create?: XOR<TurnCreateWithoutMatchInput, TurnUncheckedCreateWithoutMatchInput> | TurnCreateWithoutMatchInput[] | TurnUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TurnCreateOrConnectWithoutMatchInput | TurnCreateOrConnectWithoutMatchInput[]
    createMany?: TurnCreateManyMatchInputEnvelope
    connect?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
  }

  export type TeamSelectionCreateNestedManyWithoutMatchInput = {
    create?: XOR<TeamSelectionCreateWithoutMatchInput, TeamSelectionUncheckedCreateWithoutMatchInput> | TeamSelectionCreateWithoutMatchInput[] | TeamSelectionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutMatchInput | TeamSelectionCreateOrConnectWithoutMatchInput[]
    createMany?: TeamSelectionCreateManyMatchInputEnvelope
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutMatchesInput = {
    create?: XOR<UserCreateWithoutMatchesInput, UserUncheckedCreateWithoutMatchesInput> | UserCreateWithoutMatchesInput[] | UserUncheckedCreateWithoutMatchesInput[]
    connectOrCreate?: UserCreateOrConnectWithoutMatchesInput | UserCreateOrConnectWithoutMatchesInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type TurnUncheckedCreateNestedManyWithoutMatchInput = {
    create?: XOR<TurnCreateWithoutMatchInput, TurnUncheckedCreateWithoutMatchInput> | TurnCreateWithoutMatchInput[] | TurnUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TurnCreateOrConnectWithoutMatchInput | TurnCreateOrConnectWithoutMatchInput[]
    createMany?: TurnCreateManyMatchInputEnvelope
    connect?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
  }

  export type TeamSelectionUncheckedCreateNestedManyWithoutMatchInput = {
    create?: XOR<TeamSelectionCreateWithoutMatchInput, TeamSelectionUncheckedCreateWithoutMatchInput> | TeamSelectionCreateWithoutMatchInput[] | TeamSelectionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutMatchInput | TeamSelectionCreateOrConnectWithoutMatchInput[]
    createMany?: TeamSelectionCreateManyMatchInputEnvelope
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
  }

  export type UserUpdateOneWithoutCreatedMatchesNestedInput = {
    create?: XOR<UserCreateWithoutCreatedMatchesInput, UserUncheckedCreateWithoutCreatedMatchesInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedMatchesInput
    upsert?: UserUpsertWithoutCreatedMatchesInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCreatedMatchesInput, UserUpdateWithoutCreatedMatchesInput>, UserUncheckedUpdateWithoutCreatedMatchesInput>
  }

  export type UserUpdateManyWithoutMatchesNestedInput = {
    create?: XOR<UserCreateWithoutMatchesInput, UserUncheckedCreateWithoutMatchesInput> | UserCreateWithoutMatchesInput[] | UserUncheckedCreateWithoutMatchesInput[]
    connectOrCreate?: UserCreateOrConnectWithoutMatchesInput | UserCreateOrConnectWithoutMatchesInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutMatchesInput | UserUpsertWithWhereUniqueWithoutMatchesInput[]
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutMatchesInput | UserUpdateWithWhereUniqueWithoutMatchesInput[]
    updateMany?: UserUpdateManyWithWhereWithoutMatchesInput | UserUpdateManyWithWhereWithoutMatchesInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type TurnUpdateManyWithoutMatchNestedInput = {
    create?: XOR<TurnCreateWithoutMatchInput, TurnUncheckedCreateWithoutMatchInput> | TurnCreateWithoutMatchInput[] | TurnUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TurnCreateOrConnectWithoutMatchInput | TurnCreateOrConnectWithoutMatchInput[]
    upsert?: TurnUpsertWithWhereUniqueWithoutMatchInput | TurnUpsertWithWhereUniqueWithoutMatchInput[]
    createMany?: TurnCreateManyMatchInputEnvelope
    set?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    disconnect?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    delete?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    connect?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    update?: TurnUpdateWithWhereUniqueWithoutMatchInput | TurnUpdateWithWhereUniqueWithoutMatchInput[]
    updateMany?: TurnUpdateManyWithWhereWithoutMatchInput | TurnUpdateManyWithWhereWithoutMatchInput[]
    deleteMany?: TurnScalarWhereInput | TurnScalarWhereInput[]
  }

  export type TeamSelectionUpdateManyWithoutMatchNestedInput = {
    create?: XOR<TeamSelectionCreateWithoutMatchInput, TeamSelectionUncheckedCreateWithoutMatchInput> | TeamSelectionCreateWithoutMatchInput[] | TeamSelectionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutMatchInput | TeamSelectionCreateOrConnectWithoutMatchInput[]
    upsert?: TeamSelectionUpsertWithWhereUniqueWithoutMatchInput | TeamSelectionUpsertWithWhereUniqueWithoutMatchInput[]
    createMany?: TeamSelectionCreateManyMatchInputEnvelope
    set?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    disconnect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    delete?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    update?: TeamSelectionUpdateWithWhereUniqueWithoutMatchInput | TeamSelectionUpdateWithWhereUniqueWithoutMatchInput[]
    updateMany?: TeamSelectionUpdateManyWithWhereWithoutMatchInput | TeamSelectionUpdateManyWithWhereWithoutMatchInput[]
    deleteMany?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutMatchesNestedInput = {
    create?: XOR<UserCreateWithoutMatchesInput, UserUncheckedCreateWithoutMatchesInput> | UserCreateWithoutMatchesInput[] | UserUncheckedCreateWithoutMatchesInput[]
    connectOrCreate?: UserCreateOrConnectWithoutMatchesInput | UserCreateOrConnectWithoutMatchesInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutMatchesInput | UserUpsertWithWhereUniqueWithoutMatchesInput[]
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutMatchesInput | UserUpdateWithWhereUniqueWithoutMatchesInput[]
    updateMany?: UserUpdateManyWithWhereWithoutMatchesInput | UserUpdateManyWithWhereWithoutMatchesInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type TurnUncheckedUpdateManyWithoutMatchNestedInput = {
    create?: XOR<TurnCreateWithoutMatchInput, TurnUncheckedCreateWithoutMatchInput> | TurnCreateWithoutMatchInput[] | TurnUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TurnCreateOrConnectWithoutMatchInput | TurnCreateOrConnectWithoutMatchInput[]
    upsert?: TurnUpsertWithWhereUniqueWithoutMatchInput | TurnUpsertWithWhereUniqueWithoutMatchInput[]
    createMany?: TurnCreateManyMatchInputEnvelope
    set?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    disconnect?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    delete?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    connect?: TurnWhereUniqueInput | TurnWhereUniqueInput[]
    update?: TurnUpdateWithWhereUniqueWithoutMatchInput | TurnUpdateWithWhereUniqueWithoutMatchInput[]
    updateMany?: TurnUpdateManyWithWhereWithoutMatchInput | TurnUpdateManyWithWhereWithoutMatchInput[]
    deleteMany?: TurnScalarWhereInput | TurnScalarWhereInput[]
  }

  export type TeamSelectionUncheckedUpdateManyWithoutMatchNestedInput = {
    create?: XOR<TeamSelectionCreateWithoutMatchInput, TeamSelectionUncheckedCreateWithoutMatchInput> | TeamSelectionCreateWithoutMatchInput[] | TeamSelectionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutMatchInput | TeamSelectionCreateOrConnectWithoutMatchInput[]
    upsert?: TeamSelectionUpsertWithWhereUniqueWithoutMatchInput | TeamSelectionUpsertWithWhereUniqueWithoutMatchInput[]
    createMany?: TeamSelectionCreateManyMatchInputEnvelope
    set?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    disconnect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    delete?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    update?: TeamSelectionUpdateWithWhereUniqueWithoutMatchInput | TeamSelectionUpdateWithWhereUniqueWithoutMatchInput[]
    updateMany?: TeamSelectionUpdateManyWithWhereWithoutMatchInput | TeamSelectionUpdateManyWithWhereWithoutMatchInput[]
    deleteMany?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
  }

  export type MatchCreateNestedOneWithoutTurnsInput = {
    create?: XOR<MatchCreateWithoutTurnsInput, MatchUncheckedCreateWithoutTurnsInput>
    connectOrCreate?: MatchCreateOrConnectWithoutTurnsInput
    connect?: MatchWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type MatchUpdateOneRequiredWithoutTurnsNestedInput = {
    create?: XOR<MatchCreateWithoutTurnsInput, MatchUncheckedCreateWithoutTurnsInput>
    connectOrCreate?: MatchCreateOrConnectWithoutTurnsInput
    upsert?: MatchUpsertWithoutTurnsInput
    connect?: MatchWhereUniqueInput
    update?: XOR<XOR<MatchUpdateToOneWithWhereWithoutTurnsInput, MatchUpdateWithoutTurnsInput>, MatchUncheckedUpdateWithoutTurnsInput>
  }

  export type MatchCreateNestedOneWithoutTeamSelectionsInput = {
    create?: XOR<MatchCreateWithoutTeamSelectionsInput, MatchUncheckedCreateWithoutTeamSelectionsInput>
    connectOrCreate?: MatchCreateOrConnectWithoutTeamSelectionsInput
    connect?: MatchWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutTeamSelectionsInput = {
    create?: XOR<UserCreateWithoutTeamSelectionsInput, UserUncheckedCreateWithoutTeamSelectionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutTeamSelectionsInput
    connect?: UserWhereUniqueInput
  }

  export type TeamCreateNestedOneWithoutSelectionsInput = {
    create?: XOR<TeamCreateWithoutSelectionsInput, TeamUncheckedCreateWithoutSelectionsInput>
    connectOrCreate?: TeamCreateOrConnectWithoutSelectionsInput
    connect?: TeamWhereUniqueInput
  }

  export type MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput = {
    create?: XOR<MatchCreateWithoutTeamSelectionsInput, MatchUncheckedCreateWithoutTeamSelectionsInput>
    connectOrCreate?: MatchCreateOrConnectWithoutTeamSelectionsInput
    upsert?: MatchUpsertWithoutTeamSelectionsInput
    connect?: MatchWhereUniqueInput
    update?: XOR<XOR<MatchUpdateToOneWithWhereWithoutTeamSelectionsInput, MatchUpdateWithoutTeamSelectionsInput>, MatchUncheckedUpdateWithoutTeamSelectionsInput>
  }

  export type UserUpdateOneRequiredWithoutTeamSelectionsNestedInput = {
    create?: XOR<UserCreateWithoutTeamSelectionsInput, UserUncheckedCreateWithoutTeamSelectionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutTeamSelectionsInput
    upsert?: UserUpsertWithoutTeamSelectionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutTeamSelectionsInput, UserUpdateWithoutTeamSelectionsInput>, UserUncheckedUpdateWithoutTeamSelectionsInput>
  }

  export type TeamUpdateOneWithoutSelectionsNestedInput = {
    create?: XOR<TeamCreateWithoutSelectionsInput, TeamUncheckedCreateWithoutSelectionsInput>
    connectOrCreate?: TeamCreateOrConnectWithoutSelectionsInput
    upsert?: TeamUpsertWithoutSelectionsInput
    disconnect?: TeamWhereInput | boolean
    delete?: TeamWhereInput | boolean
    connect?: TeamWhereUniqueInput
    update?: XOR<XOR<TeamUpdateToOneWithWhereWithoutSelectionsInput, TeamUpdateWithoutSelectionsInput>, TeamUncheckedUpdateWithoutSelectionsInput>
  }

  export type UserCreateNestedOneWithoutTeamsInput = {
    create?: XOR<UserCreateWithoutTeamsInput, UserUncheckedCreateWithoutTeamsInput>
    connectOrCreate?: UserCreateOrConnectWithoutTeamsInput
    connect?: UserWhereUniqueInput
  }

  export type TeamPlayerCreateNestedManyWithoutTeamInput = {
    create?: XOR<TeamPlayerCreateWithoutTeamInput, TeamPlayerUncheckedCreateWithoutTeamInput> | TeamPlayerCreateWithoutTeamInput[] | TeamPlayerUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: TeamPlayerCreateOrConnectWithoutTeamInput | TeamPlayerCreateOrConnectWithoutTeamInput[]
    createMany?: TeamPlayerCreateManyTeamInputEnvelope
    connect?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
  }

  export type TeamSelectionCreateNestedManyWithoutTeamRefInput = {
    create?: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput> | TeamSelectionCreateWithoutTeamRefInput[] | TeamSelectionUncheckedCreateWithoutTeamRefInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutTeamRefInput | TeamSelectionCreateOrConnectWithoutTeamRefInput[]
    createMany?: TeamSelectionCreateManyTeamRefInputEnvelope
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
  }

  export type TeamPlayerUncheckedCreateNestedManyWithoutTeamInput = {
    create?: XOR<TeamPlayerCreateWithoutTeamInput, TeamPlayerUncheckedCreateWithoutTeamInput> | TeamPlayerCreateWithoutTeamInput[] | TeamPlayerUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: TeamPlayerCreateOrConnectWithoutTeamInput | TeamPlayerCreateOrConnectWithoutTeamInput[]
    createMany?: TeamPlayerCreateManyTeamInputEnvelope
    connect?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
  }

  export type TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput = {
    create?: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput> | TeamSelectionCreateWithoutTeamRefInput[] | TeamSelectionUncheckedCreateWithoutTeamRefInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutTeamRefInput | TeamSelectionCreateOrConnectWithoutTeamRefInput[]
    createMany?: TeamSelectionCreateManyTeamRefInputEnvelope
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutTeamsNestedInput = {
    create?: XOR<UserCreateWithoutTeamsInput, UserUncheckedCreateWithoutTeamsInput>
    connectOrCreate?: UserCreateOrConnectWithoutTeamsInput
    upsert?: UserUpsertWithoutTeamsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutTeamsInput, UserUpdateWithoutTeamsInput>, UserUncheckedUpdateWithoutTeamsInput>
  }

  export type TeamPlayerUpdateManyWithoutTeamNestedInput = {
    create?: XOR<TeamPlayerCreateWithoutTeamInput, TeamPlayerUncheckedCreateWithoutTeamInput> | TeamPlayerCreateWithoutTeamInput[] | TeamPlayerUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: TeamPlayerCreateOrConnectWithoutTeamInput | TeamPlayerCreateOrConnectWithoutTeamInput[]
    upsert?: TeamPlayerUpsertWithWhereUniqueWithoutTeamInput | TeamPlayerUpsertWithWhereUniqueWithoutTeamInput[]
    createMany?: TeamPlayerCreateManyTeamInputEnvelope
    set?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    disconnect?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    delete?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    connect?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    update?: TeamPlayerUpdateWithWhereUniqueWithoutTeamInput | TeamPlayerUpdateWithWhereUniqueWithoutTeamInput[]
    updateMany?: TeamPlayerUpdateManyWithWhereWithoutTeamInput | TeamPlayerUpdateManyWithWhereWithoutTeamInput[]
    deleteMany?: TeamPlayerScalarWhereInput | TeamPlayerScalarWhereInput[]
  }

  export type TeamSelectionUpdateManyWithoutTeamRefNestedInput = {
    create?: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput> | TeamSelectionCreateWithoutTeamRefInput[] | TeamSelectionUncheckedCreateWithoutTeamRefInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutTeamRefInput | TeamSelectionCreateOrConnectWithoutTeamRefInput[]
    upsert?: TeamSelectionUpsertWithWhereUniqueWithoutTeamRefInput | TeamSelectionUpsertWithWhereUniqueWithoutTeamRefInput[]
    createMany?: TeamSelectionCreateManyTeamRefInputEnvelope
    set?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    disconnect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    delete?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    update?: TeamSelectionUpdateWithWhereUniqueWithoutTeamRefInput | TeamSelectionUpdateWithWhereUniqueWithoutTeamRefInput[]
    updateMany?: TeamSelectionUpdateManyWithWhereWithoutTeamRefInput | TeamSelectionUpdateManyWithWhereWithoutTeamRefInput[]
    deleteMany?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
  }

  export type TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput = {
    create?: XOR<TeamPlayerCreateWithoutTeamInput, TeamPlayerUncheckedCreateWithoutTeamInput> | TeamPlayerCreateWithoutTeamInput[] | TeamPlayerUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: TeamPlayerCreateOrConnectWithoutTeamInput | TeamPlayerCreateOrConnectWithoutTeamInput[]
    upsert?: TeamPlayerUpsertWithWhereUniqueWithoutTeamInput | TeamPlayerUpsertWithWhereUniqueWithoutTeamInput[]
    createMany?: TeamPlayerCreateManyTeamInputEnvelope
    set?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    disconnect?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    delete?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    connect?: TeamPlayerWhereUniqueInput | TeamPlayerWhereUniqueInput[]
    update?: TeamPlayerUpdateWithWhereUniqueWithoutTeamInput | TeamPlayerUpdateWithWhereUniqueWithoutTeamInput[]
    updateMany?: TeamPlayerUpdateManyWithWhereWithoutTeamInput | TeamPlayerUpdateManyWithWhereWithoutTeamInput[]
    deleteMany?: TeamPlayerScalarWhereInput | TeamPlayerScalarWhereInput[]
  }

  export type TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput = {
    create?: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput> | TeamSelectionCreateWithoutTeamRefInput[] | TeamSelectionUncheckedCreateWithoutTeamRefInput[]
    connectOrCreate?: TeamSelectionCreateOrConnectWithoutTeamRefInput | TeamSelectionCreateOrConnectWithoutTeamRefInput[]
    upsert?: TeamSelectionUpsertWithWhereUniqueWithoutTeamRefInput | TeamSelectionUpsertWithWhereUniqueWithoutTeamRefInput[]
    createMany?: TeamSelectionCreateManyTeamRefInputEnvelope
    set?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    disconnect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    delete?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    connect?: TeamSelectionWhereUniqueInput | TeamSelectionWhereUniqueInput[]
    update?: TeamSelectionUpdateWithWhereUniqueWithoutTeamRefInput | TeamSelectionUpdateWithWhereUniqueWithoutTeamRefInput[]
    updateMany?: TeamSelectionUpdateManyWithWhereWithoutTeamRefInput | TeamSelectionUpdateManyWithWhereWithoutTeamRefInput[]
    deleteMany?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
  }

  export type TeamCreateNestedOneWithoutPlayersInput = {
    create?: XOR<TeamCreateWithoutPlayersInput, TeamUncheckedCreateWithoutPlayersInput>
    connectOrCreate?: TeamCreateOrConnectWithoutPlayersInput
    connect?: TeamWhereUniqueInput
  }

  export type TeamUpdateOneRequiredWithoutPlayersNestedInput = {
    create?: XOR<TeamCreateWithoutPlayersInput, TeamUncheckedCreateWithoutPlayersInput>
    connectOrCreate?: TeamCreateOrConnectWithoutPlayersInput
    upsert?: TeamUpsertWithoutPlayersInput
    connect?: TeamWhereUniqueInput
    update?: XOR<XOR<TeamUpdateToOneWithWhereWithoutPlayersInput, TeamUpdateWithoutPlayersInput>, TeamUncheckedUpdateWithoutPlayersInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type MatchCreateWithoutPlayersInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creator?: UserCreateNestedOneWithoutCreatedMatchesInput
    turns?: TurnCreateNestedManyWithoutMatchInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutMatchInput
  }

  export type MatchUncheckedCreateWithoutPlayersInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creatorId?: string | null
    turns?: TurnUncheckedCreateNestedManyWithoutMatchInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type MatchCreateOrConnectWithoutPlayersInput = {
    where: MatchWhereUniqueInput
    create: XOR<MatchCreateWithoutPlayersInput, MatchUncheckedCreateWithoutPlayersInput>
  }

  export type MatchCreateWithoutCreatorInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    players?: UserCreateNestedManyWithoutMatchesInput
    turns?: TurnCreateNestedManyWithoutMatchInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutMatchInput
  }

  export type MatchUncheckedCreateWithoutCreatorInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    players?: UserUncheckedCreateNestedManyWithoutMatchesInput
    turns?: TurnUncheckedCreateNestedManyWithoutMatchInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type MatchCreateOrConnectWithoutCreatorInput = {
    where: MatchWhereUniqueInput
    create: XOR<MatchCreateWithoutCreatorInput, MatchUncheckedCreateWithoutCreatorInput>
  }

  export type MatchCreateManyCreatorInputEnvelope = {
    data: MatchCreateManyCreatorInput | MatchCreateManyCreatorInput[]
  }

  export type TeamCreateWithoutOwnerInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
  }

  export type TeamUncheckedCreateWithoutOwnerInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
  }

  export type TeamCreateOrConnectWithoutOwnerInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutOwnerInput, TeamUncheckedCreateWithoutOwnerInput>
  }

  export type TeamCreateManyOwnerInputEnvelope = {
    data: TeamCreateManyOwnerInput | TeamCreateManyOwnerInput[]
  }

  export type TeamSelectionCreateWithoutUserInput = {
    id?: string
    team?: string
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTeamSelectionsInput
    teamRef?: TeamCreateNestedOneWithoutSelectionsInput
  }

  export type TeamSelectionUncheckedCreateWithoutUserInput = {
    id?: string
    matchId: string
    team?: string
    teamId?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionCreateOrConnectWithoutUserInput = {
    where: TeamSelectionWhereUniqueInput
    create: XOR<TeamSelectionCreateWithoutUserInput, TeamSelectionUncheckedCreateWithoutUserInput>
  }

  export type TeamSelectionCreateManyUserInputEnvelope = {
    data: TeamSelectionCreateManyUserInput | TeamSelectionCreateManyUserInput[]
  }

  export type MatchUpsertWithWhereUniqueWithoutPlayersInput = {
    where: MatchWhereUniqueInput
    update: XOR<MatchUpdateWithoutPlayersInput, MatchUncheckedUpdateWithoutPlayersInput>
    create: XOR<MatchCreateWithoutPlayersInput, MatchUncheckedCreateWithoutPlayersInput>
  }

  export type MatchUpdateWithWhereUniqueWithoutPlayersInput = {
    where: MatchWhereUniqueInput
    data: XOR<MatchUpdateWithoutPlayersInput, MatchUncheckedUpdateWithoutPlayersInput>
  }

  export type MatchUpdateManyWithWhereWithoutPlayersInput = {
    where: MatchScalarWhereInput
    data: XOR<MatchUpdateManyMutationInput, MatchUncheckedUpdateManyWithoutPlayersInput>
  }

  export type MatchScalarWhereInput = {
    AND?: MatchScalarWhereInput | MatchScalarWhereInput[]
    OR?: MatchScalarWhereInput[]
    NOT?: MatchScalarWhereInput | MatchScalarWhereInput[]
    id?: StringFilter<"Match"> | string
    createdAt?: DateTimeFilter<"Match"> | Date | string
    status?: StringFilter<"Match"> | string
    seed?: StringFilter<"Match"> | string
    creatorId?: StringNullableFilter<"Match"> | string | null
  }

  export type MatchUpsertWithWhereUniqueWithoutCreatorInput = {
    where: MatchWhereUniqueInput
    update: XOR<MatchUpdateWithoutCreatorInput, MatchUncheckedUpdateWithoutCreatorInput>
    create: XOR<MatchCreateWithoutCreatorInput, MatchUncheckedCreateWithoutCreatorInput>
  }

  export type MatchUpdateWithWhereUniqueWithoutCreatorInput = {
    where: MatchWhereUniqueInput
    data: XOR<MatchUpdateWithoutCreatorInput, MatchUncheckedUpdateWithoutCreatorInput>
  }

  export type MatchUpdateManyWithWhereWithoutCreatorInput = {
    where: MatchScalarWhereInput
    data: XOR<MatchUpdateManyMutationInput, MatchUncheckedUpdateManyWithoutCreatorInput>
  }

  export type TeamUpsertWithWhereUniqueWithoutOwnerInput = {
    where: TeamWhereUniqueInput
    update: XOR<TeamUpdateWithoutOwnerInput, TeamUncheckedUpdateWithoutOwnerInput>
    create: XOR<TeamCreateWithoutOwnerInput, TeamUncheckedCreateWithoutOwnerInput>
  }

  export type TeamUpdateWithWhereUniqueWithoutOwnerInput = {
    where: TeamWhereUniqueInput
    data: XOR<TeamUpdateWithoutOwnerInput, TeamUncheckedUpdateWithoutOwnerInput>
  }

  export type TeamUpdateManyWithWhereWithoutOwnerInput = {
    where: TeamScalarWhereInput
    data: XOR<TeamUpdateManyMutationInput, TeamUncheckedUpdateManyWithoutOwnerInput>
  }

  export type TeamScalarWhereInput = {
    AND?: TeamScalarWhereInput | TeamScalarWhereInput[]
    OR?: TeamScalarWhereInput[]
    NOT?: TeamScalarWhereInput | TeamScalarWhereInput[]
    id?: StringFilter<"Team"> | string
    ownerId?: StringFilter<"Team"> | string
    name?: StringFilter<"Team"> | string
    roster?: StringFilter<"Team"> | string
    createdAt?: DateTimeFilter<"Team"> | Date | string
  }

  export type TeamSelectionUpsertWithWhereUniqueWithoutUserInput = {
    where: TeamSelectionWhereUniqueInput
    update: XOR<TeamSelectionUpdateWithoutUserInput, TeamSelectionUncheckedUpdateWithoutUserInput>
    create: XOR<TeamSelectionCreateWithoutUserInput, TeamSelectionUncheckedCreateWithoutUserInput>
  }

  export type TeamSelectionUpdateWithWhereUniqueWithoutUserInput = {
    where: TeamSelectionWhereUniqueInput
    data: XOR<TeamSelectionUpdateWithoutUserInput, TeamSelectionUncheckedUpdateWithoutUserInput>
  }

  export type TeamSelectionUpdateManyWithWhereWithoutUserInput = {
    where: TeamSelectionScalarWhereInput
    data: XOR<TeamSelectionUpdateManyMutationInput, TeamSelectionUncheckedUpdateManyWithoutUserInput>
  }

  export type TeamSelectionScalarWhereInput = {
    AND?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
    OR?: TeamSelectionScalarWhereInput[]
    NOT?: TeamSelectionScalarWhereInput | TeamSelectionScalarWhereInput[]
    id?: StringFilter<"TeamSelection"> | string
    matchId?: StringFilter<"TeamSelection"> | string
    userId?: StringFilter<"TeamSelection"> | string
    team?: StringFilter<"TeamSelection"> | string
    teamId?: StringNullableFilter<"TeamSelection"> | string | null
    createdAt?: DateTimeFilter<"TeamSelection"> | Date | string
  }

  export type UserCreateWithoutCreatedMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutCreatedMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutCreatedMatchesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCreatedMatchesInput, UserUncheckedCreateWithoutCreatedMatchesInput>
  }

  export type UserCreateWithoutMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutMatchesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMatchesInput, UserUncheckedCreateWithoutMatchesInput>
  }

  export type TurnCreateWithoutMatchInput = {
    id?: string
    number: number
    payload: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type TurnUncheckedCreateWithoutMatchInput = {
    id?: string
    number: number
    payload: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type TurnCreateOrConnectWithoutMatchInput = {
    where: TurnWhereUniqueInput
    create: XOR<TurnCreateWithoutMatchInput, TurnUncheckedCreateWithoutMatchInput>
  }

  export type TurnCreateManyMatchInputEnvelope = {
    data: TurnCreateManyMatchInput | TurnCreateManyMatchInput[]
  }

  export type TeamSelectionCreateWithoutMatchInput = {
    id?: string
    team?: string
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutTeamSelectionsInput
    teamRef?: TeamCreateNestedOneWithoutSelectionsInput
  }

  export type TeamSelectionUncheckedCreateWithoutMatchInput = {
    id?: string
    userId: string
    team?: string
    teamId?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionCreateOrConnectWithoutMatchInput = {
    where: TeamSelectionWhereUniqueInput
    create: XOR<TeamSelectionCreateWithoutMatchInput, TeamSelectionUncheckedCreateWithoutMatchInput>
  }

  export type TeamSelectionCreateManyMatchInputEnvelope = {
    data: TeamSelectionCreateManyMatchInput | TeamSelectionCreateManyMatchInput[]
  }

  export type UserUpsertWithoutCreatedMatchesInput = {
    update: XOR<UserUpdateWithoutCreatedMatchesInput, UserUncheckedUpdateWithoutCreatedMatchesInput>
    create: XOR<UserCreateWithoutCreatedMatchesInput, UserUncheckedCreateWithoutCreatedMatchesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCreatedMatchesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCreatedMatchesInput, UserUncheckedUpdateWithoutCreatedMatchesInput>
  }

  export type UserUpdateWithoutCreatedMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutCreatedMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserUpsertWithWhereUniqueWithoutMatchesInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutMatchesInput, UserUncheckedUpdateWithoutMatchesInput>
    create: XOR<UserCreateWithoutMatchesInput, UserUncheckedCreateWithoutMatchesInput>
  }

  export type UserUpdateWithWhereUniqueWithoutMatchesInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutMatchesInput, UserUncheckedUpdateWithoutMatchesInput>
  }

  export type UserUpdateManyWithWhereWithoutMatchesInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutMatchesInput>
  }

  export type UserScalarWhereInput = {
    AND?: UserScalarWhereInput | UserScalarWhereInput[]
    OR?: UserScalarWhereInput[]
    NOT?: UserScalarWhereInput | UserScalarWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    passwordHash?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
  }

  export type TurnUpsertWithWhereUniqueWithoutMatchInput = {
    where: TurnWhereUniqueInput
    update: XOR<TurnUpdateWithoutMatchInput, TurnUncheckedUpdateWithoutMatchInput>
    create: XOR<TurnCreateWithoutMatchInput, TurnUncheckedCreateWithoutMatchInput>
  }

  export type TurnUpdateWithWhereUniqueWithoutMatchInput = {
    where: TurnWhereUniqueInput
    data: XOR<TurnUpdateWithoutMatchInput, TurnUncheckedUpdateWithoutMatchInput>
  }

  export type TurnUpdateManyWithWhereWithoutMatchInput = {
    where: TurnScalarWhereInput
    data: XOR<TurnUpdateManyMutationInput, TurnUncheckedUpdateManyWithoutMatchInput>
  }

  export type TurnScalarWhereInput = {
    AND?: TurnScalarWhereInput | TurnScalarWhereInput[]
    OR?: TurnScalarWhereInput[]
    NOT?: TurnScalarWhereInput | TurnScalarWhereInput[]
    id?: StringFilter<"Turn"> | string
    matchId?: StringFilter<"Turn"> | string
    number?: IntFilter<"Turn"> | number
    payload?: JsonFilter<"Turn">
    createdAt?: DateTimeFilter<"Turn"> | Date | string
  }

  export type TeamSelectionUpsertWithWhereUniqueWithoutMatchInput = {
    where: TeamSelectionWhereUniqueInput
    update: XOR<TeamSelectionUpdateWithoutMatchInput, TeamSelectionUncheckedUpdateWithoutMatchInput>
    create: XOR<TeamSelectionCreateWithoutMatchInput, TeamSelectionUncheckedCreateWithoutMatchInput>
  }

  export type TeamSelectionUpdateWithWhereUniqueWithoutMatchInput = {
    where: TeamSelectionWhereUniqueInput
    data: XOR<TeamSelectionUpdateWithoutMatchInput, TeamSelectionUncheckedUpdateWithoutMatchInput>
  }

  export type TeamSelectionUpdateManyWithWhereWithoutMatchInput = {
    where: TeamSelectionScalarWhereInput
    data: XOR<TeamSelectionUpdateManyMutationInput, TeamSelectionUncheckedUpdateManyWithoutMatchInput>
  }

  export type MatchCreateWithoutTurnsInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creator?: UserCreateNestedOneWithoutCreatedMatchesInput
    players?: UserCreateNestedManyWithoutMatchesInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutMatchInput
  }

  export type MatchUncheckedCreateWithoutTurnsInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creatorId?: string | null
    players?: UserUncheckedCreateNestedManyWithoutMatchesInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type MatchCreateOrConnectWithoutTurnsInput = {
    where: MatchWhereUniqueInput
    create: XOR<MatchCreateWithoutTurnsInput, MatchUncheckedCreateWithoutTurnsInput>
  }

  export type MatchUpsertWithoutTurnsInput = {
    update: XOR<MatchUpdateWithoutTurnsInput, MatchUncheckedUpdateWithoutTurnsInput>
    create: XOR<MatchCreateWithoutTurnsInput, MatchUncheckedCreateWithoutTurnsInput>
    where?: MatchWhereInput
  }

  export type MatchUpdateToOneWithWhereWithoutTurnsInput = {
    where?: MatchWhereInput
    data: XOR<MatchUpdateWithoutTurnsInput, MatchUncheckedUpdateWithoutTurnsInput>
  }

  export type MatchUpdateWithoutTurnsInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creator?: UserUpdateOneWithoutCreatedMatchesNestedInput
    players?: UserUpdateManyWithoutMatchesNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateWithoutTurnsInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creatorId?: NullableStringFieldUpdateOperationsInput | string | null
    players?: UserUncheckedUpdateManyWithoutMatchesNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type MatchCreateWithoutTeamSelectionsInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creator?: UserCreateNestedOneWithoutCreatedMatchesInput
    players?: UserCreateNestedManyWithoutMatchesInput
    turns?: TurnCreateNestedManyWithoutMatchInput
  }

  export type MatchUncheckedCreateWithoutTeamSelectionsInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
    creatorId?: string | null
    players?: UserUncheckedCreateNestedManyWithoutMatchesInput
    turns?: TurnUncheckedCreateNestedManyWithoutMatchInput
  }

  export type MatchCreateOrConnectWithoutTeamSelectionsInput = {
    where: MatchWhereUniqueInput
    create: XOR<MatchCreateWithoutTeamSelectionsInput, MatchUncheckedCreateWithoutTeamSelectionsInput>
  }

  export type UserCreateWithoutTeamSelectionsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutTeamSelectionsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutTeamSelectionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutTeamSelectionsInput, UserUncheckedCreateWithoutTeamSelectionsInput>
  }

  export type TeamCreateWithoutSelectionsInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
  }

  export type TeamUncheckedCreateWithoutSelectionsInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
  }

  export type TeamCreateOrConnectWithoutSelectionsInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutSelectionsInput, TeamUncheckedCreateWithoutSelectionsInput>
  }

  export type MatchUpsertWithoutTeamSelectionsInput = {
    update: XOR<MatchUpdateWithoutTeamSelectionsInput, MatchUncheckedUpdateWithoutTeamSelectionsInput>
    create: XOR<MatchCreateWithoutTeamSelectionsInput, MatchUncheckedCreateWithoutTeamSelectionsInput>
    where?: MatchWhereInput
  }

  export type MatchUpdateToOneWithWhereWithoutTeamSelectionsInput = {
    where?: MatchWhereInput
    data: XOR<MatchUpdateWithoutTeamSelectionsInput, MatchUncheckedUpdateWithoutTeamSelectionsInput>
  }

  export type MatchUpdateWithoutTeamSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creator?: UserUpdateOneWithoutCreatedMatchesNestedInput
    players?: UserUpdateManyWithoutMatchesNestedInput
    turns?: TurnUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateWithoutTeamSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creatorId?: NullableStringFieldUpdateOperationsInput | string | null
    players?: UserUncheckedUpdateManyWithoutMatchesNestedInput
    turns?: TurnUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type UserUpsertWithoutTeamSelectionsInput = {
    update: XOR<UserUpdateWithoutTeamSelectionsInput, UserUncheckedUpdateWithoutTeamSelectionsInput>
    create: XOR<UserCreateWithoutTeamSelectionsInput, UserUncheckedCreateWithoutTeamSelectionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutTeamSelectionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutTeamSelectionsInput, UserUncheckedUpdateWithoutTeamSelectionsInput>
  }

  export type UserUpdateWithoutTeamSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutTeamSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type TeamUpsertWithoutSelectionsInput = {
    update: XOR<TeamUpdateWithoutSelectionsInput, TeamUncheckedUpdateWithoutSelectionsInput>
    create: XOR<TeamCreateWithoutSelectionsInput, TeamUncheckedCreateWithoutSelectionsInput>
    where?: TeamWhereInput
  }

  export type TeamUpdateToOneWithWhereWithoutSelectionsInput = {
    where?: TeamWhereInput
    data: XOR<TeamUpdateWithoutSelectionsInput, TeamUncheckedUpdateWithoutSelectionsInput>
  }

  export type TeamUpdateWithoutSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
  }

  export type TeamUncheckedUpdateWithoutSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
  }

  export type UserCreateWithoutTeamsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutTeamsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    role?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutTeamsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutTeamsInput, UserUncheckedCreateWithoutTeamsInput>
  }

  export type TeamPlayerCreateWithoutTeamInput = {
    id?: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
  }

  export type TeamPlayerUncheckedCreateWithoutTeamInput = {
    id?: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
  }

  export type TeamPlayerCreateOrConnectWithoutTeamInput = {
    where: TeamPlayerWhereUniqueInput
    create: XOR<TeamPlayerCreateWithoutTeamInput, TeamPlayerUncheckedCreateWithoutTeamInput>
  }

  export type TeamPlayerCreateManyTeamInputEnvelope = {
    data: TeamPlayerCreateManyTeamInput | TeamPlayerCreateManyTeamInput[]
  }

  export type TeamSelectionCreateWithoutTeamRefInput = {
    id?: string
    team?: string
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTeamSelectionsInput
    user: UserCreateNestedOneWithoutTeamSelectionsInput
  }

  export type TeamSelectionUncheckedCreateWithoutTeamRefInput = {
    id?: string
    matchId: string
    userId: string
    team?: string
    createdAt?: Date | string
  }

  export type TeamSelectionCreateOrConnectWithoutTeamRefInput = {
    where: TeamSelectionWhereUniqueInput
    create: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput>
  }

  export type TeamSelectionCreateManyTeamRefInputEnvelope = {
    data: TeamSelectionCreateManyTeamRefInput | TeamSelectionCreateManyTeamRefInput[]
  }

  export type UserUpsertWithoutTeamsInput = {
    update: XOR<UserUpdateWithoutTeamsInput, UserUncheckedUpdateWithoutTeamsInput>
    create: XOR<UserCreateWithoutTeamsInput, UserUncheckedCreateWithoutTeamsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutTeamsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutTeamsInput, UserUncheckedUpdateWithoutTeamsInput>
  }

  export type UserUpdateWithoutTeamsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutTeamsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type TeamPlayerUpsertWithWhereUniqueWithoutTeamInput = {
    where: TeamPlayerWhereUniqueInput
    update: XOR<TeamPlayerUpdateWithoutTeamInput, TeamPlayerUncheckedUpdateWithoutTeamInput>
    create: XOR<TeamPlayerCreateWithoutTeamInput, TeamPlayerUncheckedCreateWithoutTeamInput>
  }

  export type TeamPlayerUpdateWithWhereUniqueWithoutTeamInput = {
    where: TeamPlayerWhereUniqueInput
    data: XOR<TeamPlayerUpdateWithoutTeamInput, TeamPlayerUncheckedUpdateWithoutTeamInput>
  }

  export type TeamPlayerUpdateManyWithWhereWithoutTeamInput = {
    where: TeamPlayerScalarWhereInput
    data: XOR<TeamPlayerUpdateManyMutationInput, TeamPlayerUncheckedUpdateManyWithoutTeamInput>
  }

  export type TeamPlayerScalarWhereInput = {
    AND?: TeamPlayerScalarWhereInput | TeamPlayerScalarWhereInput[]
    OR?: TeamPlayerScalarWhereInput[]
    NOT?: TeamPlayerScalarWhereInput | TeamPlayerScalarWhereInput[]
    id?: StringFilter<"TeamPlayer"> | string
    teamId?: StringFilter<"TeamPlayer"> | string
    name?: StringFilter<"TeamPlayer"> | string
    position?: StringFilter<"TeamPlayer"> | string
    number?: IntFilter<"TeamPlayer"> | number
    ma?: IntFilter<"TeamPlayer"> | number
    st?: IntFilter<"TeamPlayer"> | number
    ag?: IntFilter<"TeamPlayer"> | number
    pa?: IntFilter<"TeamPlayer"> | number
    av?: IntFilter<"TeamPlayer"> | number
    skills?: StringFilter<"TeamPlayer"> | string
  }

  export type TeamSelectionUpsertWithWhereUniqueWithoutTeamRefInput = {
    where: TeamSelectionWhereUniqueInput
    update: XOR<TeamSelectionUpdateWithoutTeamRefInput, TeamSelectionUncheckedUpdateWithoutTeamRefInput>
    create: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput>
  }

  export type TeamSelectionUpdateWithWhereUniqueWithoutTeamRefInput = {
    where: TeamSelectionWhereUniqueInput
    data: XOR<TeamSelectionUpdateWithoutTeamRefInput, TeamSelectionUncheckedUpdateWithoutTeamRefInput>
  }

  export type TeamSelectionUpdateManyWithWhereWithoutTeamRefInput = {
    where: TeamSelectionScalarWhereInput
    data: XOR<TeamSelectionUpdateManyMutationInput, TeamSelectionUncheckedUpdateManyWithoutTeamRefInput>
  }

  export type TeamCreateWithoutPlayersInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    owner: UserCreateNestedOneWithoutTeamsInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
  }

  export type TeamUncheckedCreateWithoutPlayersInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
  }

  export type TeamCreateOrConnectWithoutPlayersInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutPlayersInput, TeamUncheckedCreateWithoutPlayersInput>
  }

  export type TeamUpsertWithoutPlayersInput = {
    update: XOR<TeamUpdateWithoutPlayersInput, TeamUncheckedUpdateWithoutPlayersInput>
    create: XOR<TeamCreateWithoutPlayersInput, TeamUncheckedCreateWithoutPlayersInput>
    where?: TeamWhereInput
  }

  export type TeamUpdateToOneWithWhereWithoutPlayersInput = {
    where?: TeamWhereInput
    data: XOR<TeamUpdateWithoutPlayersInput, TeamUncheckedUpdateWithoutPlayersInput>
  }

  export type TeamUpdateWithoutPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
  }

  export type TeamUncheckedUpdateWithoutPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
  }

  export type MatchCreateManyCreatorInput = {
    id?: string
    createdAt?: Date | string
    status: string
    seed: string
  }

  export type TeamCreateManyOwnerInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
  }

  export type TeamSelectionCreateManyUserInput = {
    id?: string
    matchId: string
    team?: string
    teamId?: string | null
    createdAt?: Date | string
  }

  export type MatchUpdateWithoutPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creator?: UserUpdateOneWithoutCreatedMatchesNestedInput
    turns?: TurnUpdateManyWithoutMatchNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateWithoutPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creatorId?: NullableStringFieldUpdateOperationsInput | string | null
    turns?: TurnUncheckedUpdateManyWithoutMatchNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateManyWithoutPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    creatorId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type MatchUpdateWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    players?: UserUpdateManyWithoutMatchesNestedInput
    turns?: TurnUpdateManyWithoutMatchNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
    players?: UserUncheckedUpdateManyWithoutMatchesNestedInput
    turns?: TurnUncheckedUpdateManyWithoutMatchNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type MatchUncheckedUpdateManyWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: StringFieldUpdateOperationsInput | string
    seed?: StringFieldUpdateOperationsInput | string
  }

  export type TeamUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
  }

  export type TeamUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
  }

  export type TeamUncheckedUpdateManyWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput
    teamRef?: TeamUpdateOneWithoutSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TurnCreateManyMatchInput = {
    id?: string
    number: number
    payload: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type TeamSelectionCreateManyMatchInput = {
    id?: string
    userId: string
    team?: string
    teamId?: string | null
    createdAt?: Date | string
  }

  export type UserUpdateWithoutMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateManyWithoutMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TurnUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TurnUncheckedUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TurnUncheckedUpdateManyWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    payload?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutTeamSelectionsNestedInput
    teamRef?: TeamUpdateOneWithoutSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamPlayerCreateManyTeamInput = {
    id?: string
    name: string
    position: string
    number: number
    ma: number
    st: number
    ag: number
    pa: number
    av: number
    skills: string
  }

  export type TeamSelectionCreateManyTeamRefInput = {
    id?: string
    matchId: string
    userId: string
    team?: string
    createdAt?: Date | string
  }

  export type TeamPlayerUpdateWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
  }

  export type TeamPlayerUncheckedUpdateWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
  }

  export type TeamPlayerUncheckedUpdateManyWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    position?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    ma?: IntFieldUpdateOperationsInput | number
    st?: IntFieldUpdateOperationsInput | number
    ag?: IntFieldUpdateOperationsInput | number
    pa?: IntFieldUpdateOperationsInput | number
    av?: IntFieldUpdateOperationsInput | number
    skills?: StringFieldUpdateOperationsInput | string
  }

  export type TeamSelectionUpdateWithoutTeamRefInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput
    user?: UserUpdateOneRequiredWithoutTeamSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateWithoutTeamRefInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyWithoutTeamRefInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}