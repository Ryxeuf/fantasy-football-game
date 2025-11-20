
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
 * Model Cup
 * 
 */
export type Cup = $Result.DefaultSelection<Prisma.$CupPayload>
/**
 * Model CupParticipant
 * 
 */
export type CupParticipant = $Result.DefaultSelection<Prisma.$CupParticipantPayload>
/**
 * Model LocalMatch
 * 
 */
export type LocalMatch = $Result.DefaultSelection<Prisma.$LocalMatchPayload>
/**
 * Model LocalMatchAction
 * 
 */
export type LocalMatchAction = $Result.DefaultSelection<Prisma.$LocalMatchActionPayload>

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

  /**
   * `prisma.cup`: Exposes CRUD operations for the **Cup** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Cups
    * const cups = await prisma.cup.findMany()
    * ```
    */
  get cup(): Prisma.CupDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.cupParticipant`: Exposes CRUD operations for the **CupParticipant** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CupParticipants
    * const cupParticipants = await prisma.cupParticipant.findMany()
    * ```
    */
  get cupParticipant(): Prisma.CupParticipantDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.localMatch`: Exposes CRUD operations for the **LocalMatch** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more LocalMatches
    * const localMatches = await prisma.localMatch.findMany()
    * ```
    */
  get localMatch(): Prisma.LocalMatchDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.localMatchAction`: Exposes CRUD operations for the **LocalMatchAction** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more LocalMatchActions
    * const localMatchActions = await prisma.localMatchAction.findMany()
    * ```
    */
  get localMatchAction(): Prisma.LocalMatchActionDelegate<ExtArgs, ClientOptions>;
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
    TeamPlayer: 'TeamPlayer',
    Cup: 'Cup',
    CupParticipant: 'CupParticipant',
    LocalMatch: 'LocalMatch',
    LocalMatchAction: 'LocalMatchAction'
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
      modelProps: "user" | "match" | "turn" | "teamSelection" | "team" | "teamPlayer" | "cup" | "cupParticipant" | "localMatch" | "localMatchAction"
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
      Cup: {
        payload: Prisma.$CupPayload<ExtArgs>
        fields: Prisma.CupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>
          }
          findFirst: {
            args: Prisma.CupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>
          }
          findMany: {
            args: Prisma.CupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>[]
          }
          create: {
            args: Prisma.CupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>
          }
          createMany: {
            args: Prisma.CupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>[]
          }
          delete: {
            args: Prisma.CupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>
          }
          update: {
            args: Prisma.CupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>
          }
          deleteMany: {
            args: Prisma.CupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CupUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>[]
          }
          upsert: {
            args: Prisma.CupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupPayload>
          }
          aggregate: {
            args: Prisma.CupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCup>
          }
          groupBy: {
            args: Prisma.CupGroupByArgs<ExtArgs>
            result: $Utils.Optional<CupGroupByOutputType>[]
          }
          count: {
            args: Prisma.CupCountArgs<ExtArgs>
            result: $Utils.Optional<CupCountAggregateOutputType> | number
          }
        }
      }
      CupParticipant: {
        payload: Prisma.$CupParticipantPayload<ExtArgs>
        fields: Prisma.CupParticipantFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CupParticipantFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CupParticipantFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>
          }
          findFirst: {
            args: Prisma.CupParticipantFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CupParticipantFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>
          }
          findMany: {
            args: Prisma.CupParticipantFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>[]
          }
          create: {
            args: Prisma.CupParticipantCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>
          }
          createMany: {
            args: Prisma.CupParticipantCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CupParticipantCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>[]
          }
          delete: {
            args: Prisma.CupParticipantDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>
          }
          update: {
            args: Prisma.CupParticipantUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>
          }
          deleteMany: {
            args: Prisma.CupParticipantDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CupParticipantUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CupParticipantUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>[]
          }
          upsert: {
            args: Prisma.CupParticipantUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CupParticipantPayload>
          }
          aggregate: {
            args: Prisma.CupParticipantAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCupParticipant>
          }
          groupBy: {
            args: Prisma.CupParticipantGroupByArgs<ExtArgs>
            result: $Utils.Optional<CupParticipantGroupByOutputType>[]
          }
          count: {
            args: Prisma.CupParticipantCountArgs<ExtArgs>
            result: $Utils.Optional<CupParticipantCountAggregateOutputType> | number
          }
        }
      }
      LocalMatch: {
        payload: Prisma.$LocalMatchPayload<ExtArgs>
        fields: Prisma.LocalMatchFieldRefs
        operations: {
          findUnique: {
            args: Prisma.LocalMatchFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.LocalMatchFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>
          }
          findFirst: {
            args: Prisma.LocalMatchFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.LocalMatchFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>
          }
          findMany: {
            args: Prisma.LocalMatchFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>[]
          }
          create: {
            args: Prisma.LocalMatchCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>
          }
          createMany: {
            args: Prisma.LocalMatchCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.LocalMatchCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>[]
          }
          delete: {
            args: Prisma.LocalMatchDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>
          }
          update: {
            args: Prisma.LocalMatchUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>
          }
          deleteMany: {
            args: Prisma.LocalMatchDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.LocalMatchUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.LocalMatchUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>[]
          }
          upsert: {
            args: Prisma.LocalMatchUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchPayload>
          }
          aggregate: {
            args: Prisma.LocalMatchAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateLocalMatch>
          }
          groupBy: {
            args: Prisma.LocalMatchGroupByArgs<ExtArgs>
            result: $Utils.Optional<LocalMatchGroupByOutputType>[]
          }
          count: {
            args: Prisma.LocalMatchCountArgs<ExtArgs>
            result: $Utils.Optional<LocalMatchCountAggregateOutputType> | number
          }
        }
      }
      LocalMatchAction: {
        payload: Prisma.$LocalMatchActionPayload<ExtArgs>
        fields: Prisma.LocalMatchActionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.LocalMatchActionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.LocalMatchActionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>
          }
          findFirst: {
            args: Prisma.LocalMatchActionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.LocalMatchActionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>
          }
          findMany: {
            args: Prisma.LocalMatchActionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>[]
          }
          create: {
            args: Prisma.LocalMatchActionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>
          }
          createMany: {
            args: Prisma.LocalMatchActionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.LocalMatchActionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>[]
          }
          delete: {
            args: Prisma.LocalMatchActionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>
          }
          update: {
            args: Prisma.LocalMatchActionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>
          }
          deleteMany: {
            args: Prisma.LocalMatchActionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.LocalMatchActionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.LocalMatchActionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>[]
          }
          upsert: {
            args: Prisma.LocalMatchActionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocalMatchActionPayload>
          }
          aggregate: {
            args: Prisma.LocalMatchActionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateLocalMatchAction>
          }
          groupBy: {
            args: Prisma.LocalMatchActionGroupByArgs<ExtArgs>
            result: $Utils.Optional<LocalMatchActionGroupByOutputType>[]
          }
          count: {
            args: Prisma.LocalMatchActionCountArgs<ExtArgs>
            result: $Utils.Optional<LocalMatchActionCountAggregateOutputType> | number
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
    cup?: CupOmit
    cupParticipant?: CupParticipantOmit
    localMatch?: LocalMatchOmit
    localMatchAction?: LocalMatchActionOmit
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
    createdCups: number
    createdLocalMatches: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    matches?: boolean | UserCountOutputTypeCountMatchesArgs
    createdMatches?: boolean | UserCountOutputTypeCountCreatedMatchesArgs
    teams?: boolean | UserCountOutputTypeCountTeamsArgs
    teamSelections?: boolean | UserCountOutputTypeCountTeamSelectionsArgs
    createdCups?: boolean | UserCountOutputTypeCountCreatedCupsArgs
    createdLocalMatches?: boolean | UserCountOutputTypeCountCreatedLocalMatchesArgs
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
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCreatedCupsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CupWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCreatedLocalMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchWhereInput
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
    cupParticipants: number
    localMatchesAsTeamA: number
    localMatchesAsTeamB: number
  }

  export type TeamCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    players?: boolean | TeamCountOutputTypeCountPlayersArgs
    selections?: boolean | TeamCountOutputTypeCountSelectionsArgs
    cupParticipants?: boolean | TeamCountOutputTypeCountCupParticipantsArgs
    localMatchesAsTeamA?: boolean | TeamCountOutputTypeCountLocalMatchesAsTeamAArgs
    localMatchesAsTeamB?: boolean | TeamCountOutputTypeCountLocalMatchesAsTeamBArgs
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
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeCountCupParticipantsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CupParticipantWhereInput
  }

  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeCountLocalMatchesAsTeamAArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchWhereInput
  }

  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeCountLocalMatchesAsTeamBArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchWhereInput
  }


  /**
   * Count Type CupCountOutputType
   */

  export type CupCountOutputType = {
    participants: number
    localMatches: number
  }

  export type CupCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    participants?: boolean | CupCountOutputTypeCountParticipantsArgs
    localMatches?: boolean | CupCountOutputTypeCountLocalMatchesArgs
  }

  // Custom InputTypes
  /**
   * CupCountOutputType without action
   */
  export type CupCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupCountOutputType
     */
    select?: CupCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CupCountOutputType without action
   */
  export type CupCountOutputTypeCountParticipantsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CupParticipantWhereInput
  }

  /**
   * CupCountOutputType without action
   */
  export type CupCountOutputTypeCountLocalMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchWhereInput
  }


  /**
   * Count Type LocalMatchCountOutputType
   */

  export type LocalMatchCountOutputType = {
    actions: number
  }

  export type LocalMatchCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    actions?: boolean | LocalMatchCountOutputTypeCountActionsArgs
  }

  // Custom InputTypes
  /**
   * LocalMatchCountOutputType without action
   */
  export type LocalMatchCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchCountOutputType
     */
    select?: LocalMatchCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * LocalMatchCountOutputType without action
   */
  export type LocalMatchCountOutputTypeCountActionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchActionWhereInput
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
    coachName: string | null
    firstName: string | null
    lastName: string | null
    dateOfBirth: Date | null
    role: string | null
    roles: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    coachName: string | null
    firstName: string | null
    lastName: string | null
    dateOfBirth: Date | null
    role: string | null
    roles: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    passwordHash: number
    name: number
    coachName: number
    firstName: number
    lastName: number
    dateOfBirth: number
    role: number
    roles: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    coachName?: true
    firstName?: true
    lastName?: true
    dateOfBirth?: true
    role?: true
    roles?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    coachName?: true
    firstName?: true
    lastName?: true
    dateOfBirth?: true
    role?: true
    roles?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    coachName?: true
    firstName?: true
    lastName?: true
    dateOfBirth?: true
    role?: true
    roles?: true
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
    coachName: string
    firstName: string | null
    lastName: string | null
    dateOfBirth: Date | null
    role: string
    roles: string
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
    coachName?: boolean
    firstName?: boolean
    lastName?: boolean
    dateOfBirth?: boolean
    role?: boolean
    roles?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    matches?: boolean | User$matchesArgs<ExtArgs>
    createdMatches?: boolean | User$createdMatchesArgs<ExtArgs>
    teams?: boolean | User$teamsArgs<ExtArgs>
    teamSelections?: boolean | User$teamSelectionsArgs<ExtArgs>
    createdCups?: boolean | User$createdCupsArgs<ExtArgs>
    createdLocalMatches?: boolean | User$createdLocalMatchesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    coachName?: boolean
    firstName?: boolean
    lastName?: boolean
    dateOfBirth?: boolean
    role?: boolean
    roles?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    coachName?: boolean
    firstName?: boolean
    lastName?: boolean
    dateOfBirth?: boolean
    role?: boolean
    roles?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    coachName?: boolean
    firstName?: boolean
    lastName?: boolean
    dateOfBirth?: boolean
    role?: boolean
    roles?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "passwordHash" | "name" | "coachName" | "firstName" | "lastName" | "dateOfBirth" | "role" | "roles" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    matches?: boolean | User$matchesArgs<ExtArgs>
    createdMatches?: boolean | User$createdMatchesArgs<ExtArgs>
    teams?: boolean | User$teamsArgs<ExtArgs>
    teamSelections?: boolean | User$teamSelectionsArgs<ExtArgs>
    createdCups?: boolean | User$createdCupsArgs<ExtArgs>
    createdLocalMatches?: boolean | User$createdLocalMatchesArgs<ExtArgs>
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
      createdCups: Prisma.$CupPayload<ExtArgs>[]
      createdLocalMatches: Prisma.$LocalMatchPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      passwordHash: string
      name: string | null
      coachName: string
      firstName: string | null
      lastName: string | null
      dateOfBirth: Date | null
      /**
       * Rôle principal (conservé pour compatibilité, ex: "user" | "admin")
       */
      role: string
      /**
       * Liste complète des rôles (stockée en JSON, ex: '["user","admin"]')
       */
      roles: string
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
    createdCups<T extends User$createdCupsArgs<ExtArgs> = {}>(args?: Subset<T, User$createdCupsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    createdLocalMatches<T extends User$createdLocalMatchesArgs<ExtArgs> = {}>(args?: Subset<T, User$createdLocalMatchesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
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
    readonly coachName: FieldRef<"User", 'String'>
    readonly firstName: FieldRef<"User", 'String'>
    readonly lastName: FieldRef<"User", 'String'>
    readonly dateOfBirth: FieldRef<"User", 'DateTime'>
    readonly role: FieldRef<"User", 'String'>
    readonly roles: FieldRef<"User", 'String'>
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
   * User.createdCups
   */
  export type User$createdCupsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    where?: CupWhereInput
    orderBy?: CupOrderByWithRelationInput | CupOrderByWithRelationInput[]
    cursor?: CupWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CupScalarFieldEnum | CupScalarFieldEnum[]
  }

  /**
   * User.createdLocalMatches
   */
  export type User$createdLocalMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    where?: LocalMatchWhereInput
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    cursor?: LocalMatchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
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
    team: string | null
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
      team: string | null
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
    _avg: TeamAvgAggregateOutputType | null
    _sum: TeamSumAggregateOutputType | null
    _min: TeamMinAggregateOutputType | null
    _max: TeamMaxAggregateOutputType | null
  }

  export type TeamAvgAggregateOutputType = {
    treasury: number | null
    rerolls: number | null
    cheerleaders: number | null
    assistants: number | null
    dedicatedFans: number | null
    teamValue: number | null
    currentValue: number | null
    initialBudget: number | null
  }

  export type TeamSumAggregateOutputType = {
    treasury: number | null
    rerolls: number | null
    cheerleaders: number | null
    assistants: number | null
    dedicatedFans: number | null
    teamValue: number | null
    currentValue: number | null
    initialBudget: number | null
  }

  export type TeamMinAggregateOutputType = {
    id: string | null
    ownerId: string | null
    name: string | null
    roster: string | null
    createdAt: Date | null
    treasury: number | null
    rerolls: number | null
    cheerleaders: number | null
    assistants: number | null
    apothecary: boolean | null
    dedicatedFans: number | null
    teamValue: number | null
    currentValue: number | null
    initialBudget: number | null
  }

  export type TeamMaxAggregateOutputType = {
    id: string | null
    ownerId: string | null
    name: string | null
    roster: string | null
    createdAt: Date | null
    treasury: number | null
    rerolls: number | null
    cheerleaders: number | null
    assistants: number | null
    apothecary: boolean | null
    dedicatedFans: number | null
    teamValue: number | null
    currentValue: number | null
    initialBudget: number | null
  }

  export type TeamCountAggregateOutputType = {
    id: number
    ownerId: number
    name: number
    roster: number
    createdAt: number
    treasury: number
    rerolls: number
    cheerleaders: number
    assistants: number
    apothecary: number
    dedicatedFans: number
    teamValue: number
    currentValue: number
    initialBudget: number
    _all: number
  }


  export type TeamAvgAggregateInputType = {
    treasury?: true
    rerolls?: true
    cheerleaders?: true
    assistants?: true
    dedicatedFans?: true
    teamValue?: true
    currentValue?: true
    initialBudget?: true
  }

  export type TeamSumAggregateInputType = {
    treasury?: true
    rerolls?: true
    cheerleaders?: true
    assistants?: true
    dedicatedFans?: true
    teamValue?: true
    currentValue?: true
    initialBudget?: true
  }

  export type TeamMinAggregateInputType = {
    id?: true
    ownerId?: true
    name?: true
    roster?: true
    createdAt?: true
    treasury?: true
    rerolls?: true
    cheerleaders?: true
    assistants?: true
    apothecary?: true
    dedicatedFans?: true
    teamValue?: true
    currentValue?: true
    initialBudget?: true
  }

  export type TeamMaxAggregateInputType = {
    id?: true
    ownerId?: true
    name?: true
    roster?: true
    createdAt?: true
    treasury?: true
    rerolls?: true
    cheerleaders?: true
    assistants?: true
    apothecary?: true
    dedicatedFans?: true
    teamValue?: true
    currentValue?: true
    initialBudget?: true
  }

  export type TeamCountAggregateInputType = {
    id?: true
    ownerId?: true
    name?: true
    roster?: true
    createdAt?: true
    treasury?: true
    rerolls?: true
    cheerleaders?: true
    assistants?: true
    apothecary?: true
    dedicatedFans?: true
    teamValue?: true
    currentValue?: true
    initialBudget?: true
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
     * Select which fields to average
    **/
    _avg?: TeamAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TeamSumAggregateInputType
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
    _avg?: TeamAvgAggregateInputType
    _sum?: TeamSumAggregateInputType
    _min?: TeamMinAggregateInputType
    _max?: TeamMaxAggregateInputType
  }

  export type TeamGroupByOutputType = {
    id: string
    ownerId: string
    name: string
    roster: string
    createdAt: Date
    treasury: number
    rerolls: number
    cheerleaders: number
    assistants: number
    apothecary: boolean
    dedicatedFans: number
    teamValue: number
    currentValue: number
    initialBudget: number
    _count: TeamCountAggregateOutputType | null
    _avg: TeamAvgAggregateOutputType | null
    _sum: TeamSumAggregateOutputType | null
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
    treasury?: boolean
    rerolls?: boolean
    cheerleaders?: boolean
    assistants?: boolean
    apothecary?: boolean
    dedicatedFans?: boolean
    teamValue?: boolean
    currentValue?: boolean
    initialBudget?: boolean
    owner?: boolean | UserDefaultArgs<ExtArgs>
    players?: boolean | Team$playersArgs<ExtArgs>
    selections?: boolean | Team$selectionsArgs<ExtArgs>
    cupParticipants?: boolean | Team$cupParticipantsArgs<ExtArgs>
    localMatchesAsTeamA?: boolean | Team$localMatchesAsTeamAArgs<ExtArgs>
    localMatchesAsTeamB?: boolean | Team$localMatchesAsTeamBArgs<ExtArgs>
    _count?: boolean | TeamCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
    treasury?: boolean
    rerolls?: boolean
    cheerleaders?: boolean
    assistants?: boolean
    apothecary?: boolean
    dedicatedFans?: boolean
    teamValue?: boolean
    currentValue?: boolean
    initialBudget?: boolean
    owner?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
    treasury?: boolean
    rerolls?: boolean
    cheerleaders?: boolean
    assistants?: boolean
    apothecary?: boolean
    dedicatedFans?: boolean
    teamValue?: boolean
    currentValue?: boolean
    initialBudget?: boolean
    owner?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectScalar = {
    id?: boolean
    ownerId?: boolean
    name?: boolean
    roster?: boolean
    createdAt?: boolean
    treasury?: boolean
    rerolls?: boolean
    cheerleaders?: boolean
    assistants?: boolean
    apothecary?: boolean
    dedicatedFans?: boolean
    teamValue?: boolean
    currentValue?: boolean
    initialBudget?: boolean
  }

  export type TeamOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "ownerId" | "name" | "roster" | "createdAt" | "treasury" | "rerolls" | "cheerleaders" | "assistants" | "apothecary" | "dedicatedFans" | "teamValue" | "currentValue" | "initialBudget", ExtArgs["result"]["team"]>
  export type TeamInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    owner?: boolean | UserDefaultArgs<ExtArgs>
    players?: boolean | Team$playersArgs<ExtArgs>
    selections?: boolean | Team$selectionsArgs<ExtArgs>
    cupParticipants?: boolean | Team$cupParticipantsArgs<ExtArgs>
    localMatchesAsTeamA?: boolean | Team$localMatchesAsTeamAArgs<ExtArgs>
    localMatchesAsTeamB?: boolean | Team$localMatchesAsTeamBArgs<ExtArgs>
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
      cupParticipants: Prisma.$CupParticipantPayload<ExtArgs>[]
      localMatchesAsTeamA: Prisma.$LocalMatchPayload<ExtArgs>[]
      localMatchesAsTeamB: Prisma.$LocalMatchPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      ownerId: string
      name: string
      roster: string
      createdAt: Date
      treasury: number
      rerolls: number
      cheerleaders: number
      assistants: number
      apothecary: boolean
      dedicatedFans: number
      teamValue: number
      currentValue: number
      initialBudget: number
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
    cupParticipants<T extends Team$cupParticipantsArgs<ExtArgs> = {}>(args?: Subset<T, Team$cupParticipantsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    localMatchesAsTeamA<T extends Team$localMatchesAsTeamAArgs<ExtArgs> = {}>(args?: Subset<T, Team$localMatchesAsTeamAArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    localMatchesAsTeamB<T extends Team$localMatchesAsTeamBArgs<ExtArgs> = {}>(args?: Subset<T, Team$localMatchesAsTeamBArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
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
    readonly treasury: FieldRef<"Team", 'Int'>
    readonly rerolls: FieldRef<"Team", 'Int'>
    readonly cheerleaders: FieldRef<"Team", 'Int'>
    readonly assistants: FieldRef<"Team", 'Int'>
    readonly apothecary: FieldRef<"Team", 'Boolean'>
    readonly dedicatedFans: FieldRef<"Team", 'Int'>
    readonly teamValue: FieldRef<"Team", 'Int'>
    readonly currentValue: FieldRef<"Team", 'Int'>
    readonly initialBudget: FieldRef<"Team", 'Int'>
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
   * Team.cupParticipants
   */
  export type Team$cupParticipantsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    where?: CupParticipantWhereInput
    orderBy?: CupParticipantOrderByWithRelationInput | CupParticipantOrderByWithRelationInput[]
    cursor?: CupParticipantWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CupParticipantScalarFieldEnum | CupParticipantScalarFieldEnum[]
  }

  /**
   * Team.localMatchesAsTeamA
   */
  export type Team$localMatchesAsTeamAArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    where?: LocalMatchWhereInput
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    cursor?: LocalMatchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
  }

  /**
   * Team.localMatchesAsTeamB
   */
  export type Team$localMatchesAsTeamBArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    where?: LocalMatchWhereInput
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    cursor?: LocalMatchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
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
   * Model Cup
   */

  export type AggregateCup = {
    _count: CupCountAggregateOutputType | null
    _min: CupMinAggregateOutputType | null
    _max: CupMaxAggregateOutputType | null
  }

  export type CupMinAggregateOutputType = {
    id: string | null
    name: string | null
    creatorId: string | null
    validated: boolean | null
    isPublic: boolean | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CupMaxAggregateOutputType = {
    id: string | null
    name: string | null
    creatorId: string | null
    validated: boolean | null
    isPublic: boolean | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CupCountAggregateOutputType = {
    id: number
    name: number
    creatorId: number
    validated: number
    isPublic: number
    status: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CupMinAggregateInputType = {
    id?: true
    name?: true
    creatorId?: true
    validated?: true
    isPublic?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CupMaxAggregateInputType = {
    id?: true
    name?: true
    creatorId?: true
    validated?: true
    isPublic?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CupCountAggregateInputType = {
    id?: true
    name?: true
    creatorId?: true
    validated?: true
    isPublic?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Cup to aggregate.
     */
    where?: CupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cups to fetch.
     */
    orderBy?: CupOrderByWithRelationInput | CupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Cups
    **/
    _count?: true | CupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CupMaxAggregateInputType
  }

  export type GetCupAggregateType<T extends CupAggregateArgs> = {
        [P in keyof T & keyof AggregateCup]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCup[P]>
      : GetScalarType<T[P], AggregateCup[P]>
  }




  export type CupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CupWhereInput
    orderBy?: CupOrderByWithAggregationInput | CupOrderByWithAggregationInput[]
    by: CupScalarFieldEnum[] | CupScalarFieldEnum
    having?: CupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CupCountAggregateInputType | true
    _min?: CupMinAggregateInputType
    _max?: CupMaxAggregateInputType
  }

  export type CupGroupByOutputType = {
    id: string
    name: string
    creatorId: string
    validated: boolean
    isPublic: boolean
    status: string
    createdAt: Date
    updatedAt: Date
    _count: CupCountAggregateOutputType | null
    _min: CupMinAggregateOutputType | null
    _max: CupMaxAggregateOutputType | null
  }

  type GetCupGroupByPayload<T extends CupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CupGroupByOutputType[P]>
            : GetScalarType<T[P], CupGroupByOutputType[P]>
        }
      >
    >


  export type CupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    creatorId?: boolean
    validated?: boolean
    isPublic?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    creator?: boolean | UserDefaultArgs<ExtArgs>
    participants?: boolean | Cup$participantsArgs<ExtArgs>
    localMatches?: boolean | Cup$localMatchesArgs<ExtArgs>
    _count?: boolean | CupCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["cup"]>

  export type CupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    creatorId?: boolean
    validated?: boolean
    isPublic?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    creator?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["cup"]>

  export type CupSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    creatorId?: boolean
    validated?: boolean
    isPublic?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    creator?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["cup"]>

  export type CupSelectScalar = {
    id?: boolean
    name?: boolean
    creatorId?: boolean
    validated?: boolean
    isPublic?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CupOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "creatorId" | "validated" | "isPublic" | "status" | "createdAt" | "updatedAt", ExtArgs["result"]["cup"]>
  export type CupInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | UserDefaultArgs<ExtArgs>
    participants?: boolean | Cup$participantsArgs<ExtArgs>
    localMatches?: boolean | Cup$localMatchesArgs<ExtArgs>
    _count?: boolean | CupCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CupIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type CupIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $CupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Cup"
    objects: {
      creator: Prisma.$UserPayload<ExtArgs>
      participants: Prisma.$CupParticipantPayload<ExtArgs>[]
      localMatches: Prisma.$LocalMatchPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      creatorId: string
      validated: boolean
      isPublic: boolean
      status: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["cup"]>
    composites: {}
  }

  type CupGetPayload<S extends boolean | null | undefined | CupDefaultArgs> = $Result.GetResult<Prisma.$CupPayload, S>

  type CupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CupFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CupCountAggregateInputType | true
    }

  export interface CupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Cup'], meta: { name: 'Cup' } }
    /**
     * Find zero or one Cup that matches the filter.
     * @param {CupFindUniqueArgs} args - Arguments to find a Cup
     * @example
     * // Get one Cup
     * const cup = await prisma.cup.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CupFindUniqueArgs>(args: SelectSubset<T, CupFindUniqueArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Cup that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CupFindUniqueOrThrowArgs} args - Arguments to find a Cup
     * @example
     * // Get one Cup
     * const cup = await prisma.cup.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CupFindUniqueOrThrowArgs>(args: SelectSubset<T, CupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Cup that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupFindFirstArgs} args - Arguments to find a Cup
     * @example
     * // Get one Cup
     * const cup = await prisma.cup.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CupFindFirstArgs>(args?: SelectSubset<T, CupFindFirstArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Cup that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupFindFirstOrThrowArgs} args - Arguments to find a Cup
     * @example
     * // Get one Cup
     * const cup = await prisma.cup.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CupFindFirstOrThrowArgs>(args?: SelectSubset<T, CupFindFirstOrThrowArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Cups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Cups
     * const cups = await prisma.cup.findMany()
     * 
     * // Get first 10 Cups
     * const cups = await prisma.cup.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const cupWithIdOnly = await prisma.cup.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CupFindManyArgs>(args?: SelectSubset<T, CupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Cup.
     * @param {CupCreateArgs} args - Arguments to create a Cup.
     * @example
     * // Create one Cup
     * const Cup = await prisma.cup.create({
     *   data: {
     *     // ... data to create a Cup
     *   }
     * })
     * 
     */
    create<T extends CupCreateArgs>(args: SelectSubset<T, CupCreateArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Cups.
     * @param {CupCreateManyArgs} args - Arguments to create many Cups.
     * @example
     * // Create many Cups
     * const cup = await prisma.cup.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CupCreateManyArgs>(args?: SelectSubset<T, CupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Cups and returns the data saved in the database.
     * @param {CupCreateManyAndReturnArgs} args - Arguments to create many Cups.
     * @example
     * // Create many Cups
     * const cup = await prisma.cup.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Cups and only return the `id`
     * const cupWithIdOnly = await prisma.cup.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CupCreateManyAndReturnArgs>(args?: SelectSubset<T, CupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Cup.
     * @param {CupDeleteArgs} args - Arguments to delete one Cup.
     * @example
     * // Delete one Cup
     * const Cup = await prisma.cup.delete({
     *   where: {
     *     // ... filter to delete one Cup
     *   }
     * })
     * 
     */
    delete<T extends CupDeleteArgs>(args: SelectSubset<T, CupDeleteArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Cup.
     * @param {CupUpdateArgs} args - Arguments to update one Cup.
     * @example
     * // Update one Cup
     * const cup = await prisma.cup.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CupUpdateArgs>(args: SelectSubset<T, CupUpdateArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Cups.
     * @param {CupDeleteManyArgs} args - Arguments to filter Cups to delete.
     * @example
     * // Delete a few Cups
     * const { count } = await prisma.cup.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CupDeleteManyArgs>(args?: SelectSubset<T, CupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Cups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Cups
     * const cup = await prisma.cup.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CupUpdateManyArgs>(args: SelectSubset<T, CupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Cups and returns the data updated in the database.
     * @param {CupUpdateManyAndReturnArgs} args - Arguments to update many Cups.
     * @example
     * // Update many Cups
     * const cup = await prisma.cup.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Cups and only return the `id`
     * const cupWithIdOnly = await prisma.cup.updateManyAndReturn({
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
    updateManyAndReturn<T extends CupUpdateManyAndReturnArgs>(args: SelectSubset<T, CupUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Cup.
     * @param {CupUpsertArgs} args - Arguments to update or create a Cup.
     * @example
     * // Update or create a Cup
     * const cup = await prisma.cup.upsert({
     *   create: {
     *     // ... data to create a Cup
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Cup we want to update
     *   }
     * })
     */
    upsert<T extends CupUpsertArgs>(args: SelectSubset<T, CupUpsertArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Cups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupCountArgs} args - Arguments to filter Cups to count.
     * @example
     * // Count the number of Cups
     * const count = await prisma.cup.count({
     *   where: {
     *     // ... the filter for the Cups we want to count
     *   }
     * })
    **/
    count<T extends CupCountArgs>(
      args?: Subset<T, CupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Cup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends CupAggregateArgs>(args: Subset<T, CupAggregateArgs>): Prisma.PrismaPromise<GetCupAggregateType<T>>

    /**
     * Group by Cup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupGroupByArgs} args - Group by arguments.
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
      T extends CupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CupGroupByArgs['orderBy'] }
        : { orderBy?: CupGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, CupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Cup model
   */
  readonly fields: CupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Cup.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    creator<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    participants<T extends Cup$participantsArgs<ExtArgs> = {}>(args?: Subset<T, Cup$participantsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    localMatches<T extends Cup$localMatchesArgs<ExtArgs> = {}>(args?: Subset<T, Cup$localMatchesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
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
   * Fields of the Cup model
   */
  interface CupFieldRefs {
    readonly id: FieldRef<"Cup", 'String'>
    readonly name: FieldRef<"Cup", 'String'>
    readonly creatorId: FieldRef<"Cup", 'String'>
    readonly validated: FieldRef<"Cup", 'Boolean'>
    readonly isPublic: FieldRef<"Cup", 'Boolean'>
    readonly status: FieldRef<"Cup", 'String'>
    readonly createdAt: FieldRef<"Cup", 'DateTime'>
    readonly updatedAt: FieldRef<"Cup", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Cup findUnique
   */
  export type CupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * Filter, which Cup to fetch.
     */
    where: CupWhereUniqueInput
  }

  /**
   * Cup findUniqueOrThrow
   */
  export type CupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * Filter, which Cup to fetch.
     */
    where: CupWhereUniqueInput
  }

  /**
   * Cup findFirst
   */
  export type CupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * Filter, which Cup to fetch.
     */
    where?: CupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cups to fetch.
     */
    orderBy?: CupOrderByWithRelationInput | CupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Cups.
     */
    cursor?: CupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Cups.
     */
    distinct?: CupScalarFieldEnum | CupScalarFieldEnum[]
  }

  /**
   * Cup findFirstOrThrow
   */
  export type CupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * Filter, which Cup to fetch.
     */
    where?: CupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cups to fetch.
     */
    orderBy?: CupOrderByWithRelationInput | CupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Cups.
     */
    cursor?: CupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Cups.
     */
    distinct?: CupScalarFieldEnum | CupScalarFieldEnum[]
  }

  /**
   * Cup findMany
   */
  export type CupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * Filter, which Cups to fetch.
     */
    where?: CupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Cups to fetch.
     */
    orderBy?: CupOrderByWithRelationInput | CupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Cups.
     */
    cursor?: CupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Cups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Cups.
     */
    skip?: number
    distinct?: CupScalarFieldEnum | CupScalarFieldEnum[]
  }

  /**
   * Cup create
   */
  export type CupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * The data needed to create a Cup.
     */
    data: XOR<CupCreateInput, CupUncheckedCreateInput>
  }

  /**
   * Cup createMany
   */
  export type CupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Cups.
     */
    data: CupCreateManyInput | CupCreateManyInput[]
  }

  /**
   * Cup createManyAndReturn
   */
  export type CupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * The data used to create many Cups.
     */
    data: CupCreateManyInput | CupCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Cup update
   */
  export type CupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * The data needed to update a Cup.
     */
    data: XOR<CupUpdateInput, CupUncheckedUpdateInput>
    /**
     * Choose, which Cup to update.
     */
    where: CupWhereUniqueInput
  }

  /**
   * Cup updateMany
   */
  export type CupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Cups.
     */
    data: XOR<CupUpdateManyMutationInput, CupUncheckedUpdateManyInput>
    /**
     * Filter which Cups to update
     */
    where?: CupWhereInput
    /**
     * Limit how many Cups to update.
     */
    limit?: number
  }

  /**
   * Cup updateManyAndReturn
   */
  export type CupUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * The data used to update Cups.
     */
    data: XOR<CupUpdateManyMutationInput, CupUncheckedUpdateManyInput>
    /**
     * Filter which Cups to update
     */
    where?: CupWhereInput
    /**
     * Limit how many Cups to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Cup upsert
   */
  export type CupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * The filter to search for the Cup to update in case it exists.
     */
    where: CupWhereUniqueInput
    /**
     * In case the Cup found by the `where` argument doesn't exist, create a new Cup with this data.
     */
    create: XOR<CupCreateInput, CupUncheckedCreateInput>
    /**
     * In case the Cup was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CupUpdateInput, CupUncheckedUpdateInput>
  }

  /**
   * Cup delete
   */
  export type CupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    /**
     * Filter which Cup to delete.
     */
    where: CupWhereUniqueInput
  }

  /**
   * Cup deleteMany
   */
  export type CupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Cups to delete
     */
    where?: CupWhereInput
    /**
     * Limit how many Cups to delete.
     */
    limit?: number
  }

  /**
   * Cup.participants
   */
  export type Cup$participantsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    where?: CupParticipantWhereInput
    orderBy?: CupParticipantOrderByWithRelationInput | CupParticipantOrderByWithRelationInput[]
    cursor?: CupParticipantWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CupParticipantScalarFieldEnum | CupParticipantScalarFieldEnum[]
  }

  /**
   * Cup.localMatches
   */
  export type Cup$localMatchesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    where?: LocalMatchWhereInput
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    cursor?: LocalMatchWhereUniqueInput
    take?: number
    skip?: number
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
  }

  /**
   * Cup without action
   */
  export type CupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
  }


  /**
   * Model CupParticipant
   */

  export type AggregateCupParticipant = {
    _count: CupParticipantCountAggregateOutputType | null
    _min: CupParticipantMinAggregateOutputType | null
    _max: CupParticipantMaxAggregateOutputType | null
  }

  export type CupParticipantMinAggregateOutputType = {
    id: string | null
    cupId: string | null
    teamId: string | null
    createdAt: Date | null
  }

  export type CupParticipantMaxAggregateOutputType = {
    id: string | null
    cupId: string | null
    teamId: string | null
    createdAt: Date | null
  }

  export type CupParticipantCountAggregateOutputType = {
    id: number
    cupId: number
    teamId: number
    createdAt: number
    _all: number
  }


  export type CupParticipantMinAggregateInputType = {
    id?: true
    cupId?: true
    teamId?: true
    createdAt?: true
  }

  export type CupParticipantMaxAggregateInputType = {
    id?: true
    cupId?: true
    teamId?: true
    createdAt?: true
  }

  export type CupParticipantCountAggregateInputType = {
    id?: true
    cupId?: true
    teamId?: true
    createdAt?: true
    _all?: true
  }

  export type CupParticipantAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CupParticipant to aggregate.
     */
    where?: CupParticipantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CupParticipants to fetch.
     */
    orderBy?: CupParticipantOrderByWithRelationInput | CupParticipantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CupParticipantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CupParticipants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CupParticipants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CupParticipants
    **/
    _count?: true | CupParticipantCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CupParticipantMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CupParticipantMaxAggregateInputType
  }

  export type GetCupParticipantAggregateType<T extends CupParticipantAggregateArgs> = {
        [P in keyof T & keyof AggregateCupParticipant]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCupParticipant[P]>
      : GetScalarType<T[P], AggregateCupParticipant[P]>
  }




  export type CupParticipantGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CupParticipantWhereInput
    orderBy?: CupParticipantOrderByWithAggregationInput | CupParticipantOrderByWithAggregationInput[]
    by: CupParticipantScalarFieldEnum[] | CupParticipantScalarFieldEnum
    having?: CupParticipantScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CupParticipantCountAggregateInputType | true
    _min?: CupParticipantMinAggregateInputType
    _max?: CupParticipantMaxAggregateInputType
  }

  export type CupParticipantGroupByOutputType = {
    id: string
    cupId: string
    teamId: string
    createdAt: Date
    _count: CupParticipantCountAggregateOutputType | null
    _min: CupParticipantMinAggregateOutputType | null
    _max: CupParticipantMaxAggregateOutputType | null
  }

  type GetCupParticipantGroupByPayload<T extends CupParticipantGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CupParticipantGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CupParticipantGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CupParticipantGroupByOutputType[P]>
            : GetScalarType<T[P], CupParticipantGroupByOutputType[P]>
        }
      >
    >


  export type CupParticipantSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cupId?: boolean
    teamId?: boolean
    createdAt?: boolean
    cup?: boolean | CupDefaultArgs<ExtArgs>
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["cupParticipant"]>

  export type CupParticipantSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cupId?: boolean
    teamId?: boolean
    createdAt?: boolean
    cup?: boolean | CupDefaultArgs<ExtArgs>
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["cupParticipant"]>

  export type CupParticipantSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cupId?: boolean
    teamId?: boolean
    createdAt?: boolean
    cup?: boolean | CupDefaultArgs<ExtArgs>
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["cupParticipant"]>

  export type CupParticipantSelectScalar = {
    id?: boolean
    cupId?: boolean
    teamId?: boolean
    createdAt?: boolean
  }

  export type CupParticipantOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "cupId" | "teamId" | "createdAt", ExtArgs["result"]["cupParticipant"]>
  export type CupParticipantInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    cup?: boolean | CupDefaultArgs<ExtArgs>
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }
  export type CupParticipantIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    cup?: boolean | CupDefaultArgs<ExtArgs>
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }
  export type CupParticipantIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    cup?: boolean | CupDefaultArgs<ExtArgs>
    team?: boolean | TeamDefaultArgs<ExtArgs>
  }

  export type $CupParticipantPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CupParticipant"
    objects: {
      cup: Prisma.$CupPayload<ExtArgs>
      team: Prisma.$TeamPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      cupId: string
      teamId: string
      createdAt: Date
    }, ExtArgs["result"]["cupParticipant"]>
    composites: {}
  }

  type CupParticipantGetPayload<S extends boolean | null | undefined | CupParticipantDefaultArgs> = $Result.GetResult<Prisma.$CupParticipantPayload, S>

  type CupParticipantCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CupParticipantFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CupParticipantCountAggregateInputType | true
    }

  export interface CupParticipantDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CupParticipant'], meta: { name: 'CupParticipant' } }
    /**
     * Find zero or one CupParticipant that matches the filter.
     * @param {CupParticipantFindUniqueArgs} args - Arguments to find a CupParticipant
     * @example
     * // Get one CupParticipant
     * const cupParticipant = await prisma.cupParticipant.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CupParticipantFindUniqueArgs>(args: SelectSubset<T, CupParticipantFindUniqueArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CupParticipant that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CupParticipantFindUniqueOrThrowArgs} args - Arguments to find a CupParticipant
     * @example
     * // Get one CupParticipant
     * const cupParticipant = await prisma.cupParticipant.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CupParticipantFindUniqueOrThrowArgs>(args: SelectSubset<T, CupParticipantFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CupParticipant that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantFindFirstArgs} args - Arguments to find a CupParticipant
     * @example
     * // Get one CupParticipant
     * const cupParticipant = await prisma.cupParticipant.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CupParticipantFindFirstArgs>(args?: SelectSubset<T, CupParticipantFindFirstArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CupParticipant that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantFindFirstOrThrowArgs} args - Arguments to find a CupParticipant
     * @example
     * // Get one CupParticipant
     * const cupParticipant = await prisma.cupParticipant.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CupParticipantFindFirstOrThrowArgs>(args?: SelectSubset<T, CupParticipantFindFirstOrThrowArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CupParticipants that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CupParticipants
     * const cupParticipants = await prisma.cupParticipant.findMany()
     * 
     * // Get first 10 CupParticipants
     * const cupParticipants = await prisma.cupParticipant.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const cupParticipantWithIdOnly = await prisma.cupParticipant.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CupParticipantFindManyArgs>(args?: SelectSubset<T, CupParticipantFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CupParticipant.
     * @param {CupParticipantCreateArgs} args - Arguments to create a CupParticipant.
     * @example
     * // Create one CupParticipant
     * const CupParticipant = await prisma.cupParticipant.create({
     *   data: {
     *     // ... data to create a CupParticipant
     *   }
     * })
     * 
     */
    create<T extends CupParticipantCreateArgs>(args: SelectSubset<T, CupParticipantCreateArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CupParticipants.
     * @param {CupParticipantCreateManyArgs} args - Arguments to create many CupParticipants.
     * @example
     * // Create many CupParticipants
     * const cupParticipant = await prisma.cupParticipant.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CupParticipantCreateManyArgs>(args?: SelectSubset<T, CupParticipantCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CupParticipants and returns the data saved in the database.
     * @param {CupParticipantCreateManyAndReturnArgs} args - Arguments to create many CupParticipants.
     * @example
     * // Create many CupParticipants
     * const cupParticipant = await prisma.cupParticipant.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CupParticipants and only return the `id`
     * const cupParticipantWithIdOnly = await prisma.cupParticipant.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CupParticipantCreateManyAndReturnArgs>(args?: SelectSubset<T, CupParticipantCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CupParticipant.
     * @param {CupParticipantDeleteArgs} args - Arguments to delete one CupParticipant.
     * @example
     * // Delete one CupParticipant
     * const CupParticipant = await prisma.cupParticipant.delete({
     *   where: {
     *     // ... filter to delete one CupParticipant
     *   }
     * })
     * 
     */
    delete<T extends CupParticipantDeleteArgs>(args: SelectSubset<T, CupParticipantDeleteArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CupParticipant.
     * @param {CupParticipantUpdateArgs} args - Arguments to update one CupParticipant.
     * @example
     * // Update one CupParticipant
     * const cupParticipant = await prisma.cupParticipant.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CupParticipantUpdateArgs>(args: SelectSubset<T, CupParticipantUpdateArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CupParticipants.
     * @param {CupParticipantDeleteManyArgs} args - Arguments to filter CupParticipants to delete.
     * @example
     * // Delete a few CupParticipants
     * const { count } = await prisma.cupParticipant.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CupParticipantDeleteManyArgs>(args?: SelectSubset<T, CupParticipantDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CupParticipants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CupParticipants
     * const cupParticipant = await prisma.cupParticipant.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CupParticipantUpdateManyArgs>(args: SelectSubset<T, CupParticipantUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CupParticipants and returns the data updated in the database.
     * @param {CupParticipantUpdateManyAndReturnArgs} args - Arguments to update many CupParticipants.
     * @example
     * // Update many CupParticipants
     * const cupParticipant = await prisma.cupParticipant.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CupParticipants and only return the `id`
     * const cupParticipantWithIdOnly = await prisma.cupParticipant.updateManyAndReturn({
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
    updateManyAndReturn<T extends CupParticipantUpdateManyAndReturnArgs>(args: SelectSubset<T, CupParticipantUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CupParticipant.
     * @param {CupParticipantUpsertArgs} args - Arguments to update or create a CupParticipant.
     * @example
     * // Update or create a CupParticipant
     * const cupParticipant = await prisma.cupParticipant.upsert({
     *   create: {
     *     // ... data to create a CupParticipant
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CupParticipant we want to update
     *   }
     * })
     */
    upsert<T extends CupParticipantUpsertArgs>(args: SelectSubset<T, CupParticipantUpsertArgs<ExtArgs>>): Prisma__CupParticipantClient<$Result.GetResult<Prisma.$CupParticipantPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CupParticipants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantCountArgs} args - Arguments to filter CupParticipants to count.
     * @example
     * // Count the number of CupParticipants
     * const count = await prisma.cupParticipant.count({
     *   where: {
     *     // ... the filter for the CupParticipants we want to count
     *   }
     * })
    **/
    count<T extends CupParticipantCountArgs>(
      args?: Subset<T, CupParticipantCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CupParticipantCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CupParticipant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends CupParticipantAggregateArgs>(args: Subset<T, CupParticipantAggregateArgs>): Prisma.PrismaPromise<GetCupParticipantAggregateType<T>>

    /**
     * Group by CupParticipant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CupParticipantGroupByArgs} args - Group by arguments.
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
      T extends CupParticipantGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CupParticipantGroupByArgs['orderBy'] }
        : { orderBy?: CupParticipantGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, CupParticipantGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCupParticipantGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CupParticipant model
   */
  readonly fields: CupParticipantFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CupParticipant.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CupParticipantClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    cup<T extends CupDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CupDefaultArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the CupParticipant model
   */
  interface CupParticipantFieldRefs {
    readonly id: FieldRef<"CupParticipant", 'String'>
    readonly cupId: FieldRef<"CupParticipant", 'String'>
    readonly teamId: FieldRef<"CupParticipant", 'String'>
    readonly createdAt: FieldRef<"CupParticipant", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CupParticipant findUnique
   */
  export type CupParticipantFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * Filter, which CupParticipant to fetch.
     */
    where: CupParticipantWhereUniqueInput
  }

  /**
   * CupParticipant findUniqueOrThrow
   */
  export type CupParticipantFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * Filter, which CupParticipant to fetch.
     */
    where: CupParticipantWhereUniqueInput
  }

  /**
   * CupParticipant findFirst
   */
  export type CupParticipantFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * Filter, which CupParticipant to fetch.
     */
    where?: CupParticipantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CupParticipants to fetch.
     */
    orderBy?: CupParticipantOrderByWithRelationInput | CupParticipantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CupParticipants.
     */
    cursor?: CupParticipantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CupParticipants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CupParticipants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CupParticipants.
     */
    distinct?: CupParticipantScalarFieldEnum | CupParticipantScalarFieldEnum[]
  }

  /**
   * CupParticipant findFirstOrThrow
   */
  export type CupParticipantFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * Filter, which CupParticipant to fetch.
     */
    where?: CupParticipantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CupParticipants to fetch.
     */
    orderBy?: CupParticipantOrderByWithRelationInput | CupParticipantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CupParticipants.
     */
    cursor?: CupParticipantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CupParticipants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CupParticipants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CupParticipants.
     */
    distinct?: CupParticipantScalarFieldEnum | CupParticipantScalarFieldEnum[]
  }

  /**
   * CupParticipant findMany
   */
  export type CupParticipantFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * Filter, which CupParticipants to fetch.
     */
    where?: CupParticipantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CupParticipants to fetch.
     */
    orderBy?: CupParticipantOrderByWithRelationInput | CupParticipantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CupParticipants.
     */
    cursor?: CupParticipantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CupParticipants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CupParticipants.
     */
    skip?: number
    distinct?: CupParticipantScalarFieldEnum | CupParticipantScalarFieldEnum[]
  }

  /**
   * CupParticipant create
   */
  export type CupParticipantCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * The data needed to create a CupParticipant.
     */
    data: XOR<CupParticipantCreateInput, CupParticipantUncheckedCreateInput>
  }

  /**
   * CupParticipant createMany
   */
  export type CupParticipantCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CupParticipants.
     */
    data: CupParticipantCreateManyInput | CupParticipantCreateManyInput[]
  }

  /**
   * CupParticipant createManyAndReturn
   */
  export type CupParticipantCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * The data used to create many CupParticipants.
     */
    data: CupParticipantCreateManyInput | CupParticipantCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CupParticipant update
   */
  export type CupParticipantUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * The data needed to update a CupParticipant.
     */
    data: XOR<CupParticipantUpdateInput, CupParticipantUncheckedUpdateInput>
    /**
     * Choose, which CupParticipant to update.
     */
    where: CupParticipantWhereUniqueInput
  }

  /**
   * CupParticipant updateMany
   */
  export type CupParticipantUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CupParticipants.
     */
    data: XOR<CupParticipantUpdateManyMutationInput, CupParticipantUncheckedUpdateManyInput>
    /**
     * Filter which CupParticipants to update
     */
    where?: CupParticipantWhereInput
    /**
     * Limit how many CupParticipants to update.
     */
    limit?: number
  }

  /**
   * CupParticipant updateManyAndReturn
   */
  export type CupParticipantUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * The data used to update CupParticipants.
     */
    data: XOR<CupParticipantUpdateManyMutationInput, CupParticipantUncheckedUpdateManyInput>
    /**
     * Filter which CupParticipants to update
     */
    where?: CupParticipantWhereInput
    /**
     * Limit how many CupParticipants to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CupParticipant upsert
   */
  export type CupParticipantUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * The filter to search for the CupParticipant to update in case it exists.
     */
    where: CupParticipantWhereUniqueInput
    /**
     * In case the CupParticipant found by the `where` argument doesn't exist, create a new CupParticipant with this data.
     */
    create: XOR<CupParticipantCreateInput, CupParticipantUncheckedCreateInput>
    /**
     * In case the CupParticipant was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CupParticipantUpdateInput, CupParticipantUncheckedUpdateInput>
  }

  /**
   * CupParticipant delete
   */
  export type CupParticipantDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
    /**
     * Filter which CupParticipant to delete.
     */
    where: CupParticipantWhereUniqueInput
  }

  /**
   * CupParticipant deleteMany
   */
  export type CupParticipantDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CupParticipants to delete
     */
    where?: CupParticipantWhereInput
    /**
     * Limit how many CupParticipants to delete.
     */
    limit?: number
  }

  /**
   * CupParticipant without action
   */
  export type CupParticipantDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CupParticipant
     */
    select?: CupParticipantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CupParticipant
     */
    omit?: CupParticipantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupParticipantInclude<ExtArgs> | null
  }


  /**
   * Model LocalMatch
   */

  export type AggregateLocalMatch = {
    _count: LocalMatchCountAggregateOutputType | null
    _avg: LocalMatchAvgAggregateOutputType | null
    _sum: LocalMatchSumAggregateOutputType | null
    _min: LocalMatchMinAggregateOutputType | null
    _max: LocalMatchMaxAggregateOutputType | null
  }

  export type LocalMatchAvgAggregateOutputType = {
    scoreTeamA: number | null
    scoreTeamB: number | null
  }

  export type LocalMatchSumAggregateOutputType = {
    scoreTeamA: number | null
    scoreTeamB: number | null
  }

  export type LocalMatchMinAggregateOutputType = {
    id: string | null
    name: string | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    creatorId: string | null
    teamAId: string | null
    teamBId: string | null
    cupId: string | null
    shareToken: string | null
    teamAOwnerValidated: boolean | null
    teamBOwnerValidated: boolean | null
    scoreTeamA: number | null
    scoreTeamB: number | null
  }

  export type LocalMatchMaxAggregateOutputType = {
    id: string | null
    name: string | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    creatorId: string | null
    teamAId: string | null
    teamBId: string | null
    cupId: string | null
    shareToken: string | null
    teamAOwnerValidated: boolean | null
    teamBOwnerValidated: boolean | null
    scoreTeamA: number | null
    scoreTeamB: number | null
  }

  export type LocalMatchCountAggregateOutputType = {
    id: number
    name: number
    status: number
    createdAt: number
    updatedAt: number
    startedAt: number
    completedAt: number
    creatorId: number
    teamAId: number
    teamBId: number
    cupId: number
    shareToken: number
    teamAOwnerValidated: number
    teamBOwnerValidated: number
    gameState: number
    scoreTeamA: number
    scoreTeamB: number
    _all: number
  }


  export type LocalMatchAvgAggregateInputType = {
    scoreTeamA?: true
    scoreTeamB?: true
  }

  export type LocalMatchSumAggregateInputType = {
    scoreTeamA?: true
    scoreTeamB?: true
  }

  export type LocalMatchMinAggregateInputType = {
    id?: true
    name?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    startedAt?: true
    completedAt?: true
    creatorId?: true
    teamAId?: true
    teamBId?: true
    cupId?: true
    shareToken?: true
    teamAOwnerValidated?: true
    teamBOwnerValidated?: true
    scoreTeamA?: true
    scoreTeamB?: true
  }

  export type LocalMatchMaxAggregateInputType = {
    id?: true
    name?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    startedAt?: true
    completedAt?: true
    creatorId?: true
    teamAId?: true
    teamBId?: true
    cupId?: true
    shareToken?: true
    teamAOwnerValidated?: true
    teamBOwnerValidated?: true
    scoreTeamA?: true
    scoreTeamB?: true
  }

  export type LocalMatchCountAggregateInputType = {
    id?: true
    name?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    startedAt?: true
    completedAt?: true
    creatorId?: true
    teamAId?: true
    teamBId?: true
    cupId?: true
    shareToken?: true
    teamAOwnerValidated?: true
    teamBOwnerValidated?: true
    gameState?: true
    scoreTeamA?: true
    scoreTeamB?: true
    _all?: true
  }

  export type LocalMatchAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LocalMatch to aggregate.
     */
    where?: LocalMatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatches to fetch.
     */
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: LocalMatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned LocalMatches
    **/
    _count?: true | LocalMatchCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: LocalMatchAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: LocalMatchSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LocalMatchMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LocalMatchMaxAggregateInputType
  }

  export type GetLocalMatchAggregateType<T extends LocalMatchAggregateArgs> = {
        [P in keyof T & keyof AggregateLocalMatch]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLocalMatch[P]>
      : GetScalarType<T[P], AggregateLocalMatch[P]>
  }




  export type LocalMatchGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchWhereInput
    orderBy?: LocalMatchOrderByWithAggregationInput | LocalMatchOrderByWithAggregationInput[]
    by: LocalMatchScalarFieldEnum[] | LocalMatchScalarFieldEnum
    having?: LocalMatchScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LocalMatchCountAggregateInputType | true
    _avg?: LocalMatchAvgAggregateInputType
    _sum?: LocalMatchSumAggregateInputType
    _min?: LocalMatchMinAggregateInputType
    _max?: LocalMatchMaxAggregateInputType
  }

  export type LocalMatchGroupByOutputType = {
    id: string
    name: string | null
    status: string
    createdAt: Date
    updatedAt: Date
    startedAt: Date | null
    completedAt: Date | null
    creatorId: string
    teamAId: string
    teamBId: string | null
    cupId: string | null
    shareToken: string | null
    teamAOwnerValidated: boolean
    teamBOwnerValidated: boolean
    gameState: JsonValue | null
    scoreTeamA: number | null
    scoreTeamB: number | null
    _count: LocalMatchCountAggregateOutputType | null
    _avg: LocalMatchAvgAggregateOutputType | null
    _sum: LocalMatchSumAggregateOutputType | null
    _min: LocalMatchMinAggregateOutputType | null
    _max: LocalMatchMaxAggregateOutputType | null
  }

  type GetLocalMatchGroupByPayload<T extends LocalMatchGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<LocalMatchGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LocalMatchGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LocalMatchGroupByOutputType[P]>
            : GetScalarType<T[P], LocalMatchGroupByOutputType[P]>
        }
      >
    >


  export type LocalMatchSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    creatorId?: boolean
    teamAId?: boolean
    teamBId?: boolean
    cupId?: boolean
    shareToken?: boolean
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: boolean
    scoreTeamA?: boolean
    scoreTeamB?: boolean
    creator?: boolean | UserDefaultArgs<ExtArgs>
    teamA?: boolean | TeamDefaultArgs<ExtArgs>
    teamB?: boolean | LocalMatch$teamBArgs<ExtArgs>
    cup?: boolean | LocalMatch$cupArgs<ExtArgs>
    actions?: boolean | LocalMatch$actionsArgs<ExtArgs>
    _count?: boolean | LocalMatchCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["localMatch"]>

  export type LocalMatchSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    creatorId?: boolean
    teamAId?: boolean
    teamBId?: boolean
    cupId?: boolean
    shareToken?: boolean
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: boolean
    scoreTeamA?: boolean
    scoreTeamB?: boolean
    creator?: boolean | UserDefaultArgs<ExtArgs>
    teamA?: boolean | TeamDefaultArgs<ExtArgs>
    teamB?: boolean | LocalMatch$teamBArgs<ExtArgs>
    cup?: boolean | LocalMatch$cupArgs<ExtArgs>
  }, ExtArgs["result"]["localMatch"]>

  export type LocalMatchSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    creatorId?: boolean
    teamAId?: boolean
    teamBId?: boolean
    cupId?: boolean
    shareToken?: boolean
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: boolean
    scoreTeamA?: boolean
    scoreTeamB?: boolean
    creator?: boolean | UserDefaultArgs<ExtArgs>
    teamA?: boolean | TeamDefaultArgs<ExtArgs>
    teamB?: boolean | LocalMatch$teamBArgs<ExtArgs>
    cup?: boolean | LocalMatch$cupArgs<ExtArgs>
  }, ExtArgs["result"]["localMatch"]>

  export type LocalMatchSelectScalar = {
    id?: boolean
    name?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    creatorId?: boolean
    teamAId?: boolean
    teamBId?: boolean
    cupId?: boolean
    shareToken?: boolean
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: boolean
    scoreTeamA?: boolean
    scoreTeamB?: boolean
  }

  export type LocalMatchOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "status" | "createdAt" | "updatedAt" | "startedAt" | "completedAt" | "creatorId" | "teamAId" | "teamBId" | "cupId" | "shareToken" | "teamAOwnerValidated" | "teamBOwnerValidated" | "gameState" | "scoreTeamA" | "scoreTeamB", ExtArgs["result"]["localMatch"]>
  export type LocalMatchInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | UserDefaultArgs<ExtArgs>
    teamA?: boolean | TeamDefaultArgs<ExtArgs>
    teamB?: boolean | LocalMatch$teamBArgs<ExtArgs>
    cup?: boolean | LocalMatch$cupArgs<ExtArgs>
    actions?: boolean | LocalMatch$actionsArgs<ExtArgs>
    _count?: boolean | LocalMatchCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type LocalMatchIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | UserDefaultArgs<ExtArgs>
    teamA?: boolean | TeamDefaultArgs<ExtArgs>
    teamB?: boolean | LocalMatch$teamBArgs<ExtArgs>
    cup?: boolean | LocalMatch$cupArgs<ExtArgs>
  }
  export type LocalMatchIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    creator?: boolean | UserDefaultArgs<ExtArgs>
    teamA?: boolean | TeamDefaultArgs<ExtArgs>
    teamB?: boolean | LocalMatch$teamBArgs<ExtArgs>
    cup?: boolean | LocalMatch$cupArgs<ExtArgs>
  }

  export type $LocalMatchPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "LocalMatch"
    objects: {
      creator: Prisma.$UserPayload<ExtArgs>
      teamA: Prisma.$TeamPayload<ExtArgs>
      teamB: Prisma.$TeamPayload<ExtArgs> | null
      cup: Prisma.$CupPayload<ExtArgs> | null
      actions: Prisma.$LocalMatchActionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string | null
      status: string
      createdAt: Date
      updatedAt: Date
      startedAt: Date | null
      completedAt: Date | null
      creatorId: string
      teamAId: string
      teamBId: string | null
      cupId: string | null
      shareToken: string | null
      teamAOwnerValidated: boolean
      teamBOwnerValidated: boolean
      gameState: Prisma.JsonValue | null
      scoreTeamA: number | null
      scoreTeamB: number | null
    }, ExtArgs["result"]["localMatch"]>
    composites: {}
  }

  type LocalMatchGetPayload<S extends boolean | null | undefined | LocalMatchDefaultArgs> = $Result.GetResult<Prisma.$LocalMatchPayload, S>

  type LocalMatchCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<LocalMatchFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: LocalMatchCountAggregateInputType | true
    }

  export interface LocalMatchDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['LocalMatch'], meta: { name: 'LocalMatch' } }
    /**
     * Find zero or one LocalMatch that matches the filter.
     * @param {LocalMatchFindUniqueArgs} args - Arguments to find a LocalMatch
     * @example
     * // Get one LocalMatch
     * const localMatch = await prisma.localMatch.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends LocalMatchFindUniqueArgs>(args: SelectSubset<T, LocalMatchFindUniqueArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one LocalMatch that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {LocalMatchFindUniqueOrThrowArgs} args - Arguments to find a LocalMatch
     * @example
     * // Get one LocalMatch
     * const localMatch = await prisma.localMatch.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends LocalMatchFindUniqueOrThrowArgs>(args: SelectSubset<T, LocalMatchFindUniqueOrThrowArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LocalMatch that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchFindFirstArgs} args - Arguments to find a LocalMatch
     * @example
     * // Get one LocalMatch
     * const localMatch = await prisma.localMatch.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends LocalMatchFindFirstArgs>(args?: SelectSubset<T, LocalMatchFindFirstArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LocalMatch that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchFindFirstOrThrowArgs} args - Arguments to find a LocalMatch
     * @example
     * // Get one LocalMatch
     * const localMatch = await prisma.localMatch.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends LocalMatchFindFirstOrThrowArgs>(args?: SelectSubset<T, LocalMatchFindFirstOrThrowArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more LocalMatches that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all LocalMatches
     * const localMatches = await prisma.localMatch.findMany()
     * 
     * // Get first 10 LocalMatches
     * const localMatches = await prisma.localMatch.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const localMatchWithIdOnly = await prisma.localMatch.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends LocalMatchFindManyArgs>(args?: SelectSubset<T, LocalMatchFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a LocalMatch.
     * @param {LocalMatchCreateArgs} args - Arguments to create a LocalMatch.
     * @example
     * // Create one LocalMatch
     * const LocalMatch = await prisma.localMatch.create({
     *   data: {
     *     // ... data to create a LocalMatch
     *   }
     * })
     * 
     */
    create<T extends LocalMatchCreateArgs>(args: SelectSubset<T, LocalMatchCreateArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many LocalMatches.
     * @param {LocalMatchCreateManyArgs} args - Arguments to create many LocalMatches.
     * @example
     * // Create many LocalMatches
     * const localMatch = await prisma.localMatch.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends LocalMatchCreateManyArgs>(args?: SelectSubset<T, LocalMatchCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many LocalMatches and returns the data saved in the database.
     * @param {LocalMatchCreateManyAndReturnArgs} args - Arguments to create many LocalMatches.
     * @example
     * // Create many LocalMatches
     * const localMatch = await prisma.localMatch.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many LocalMatches and only return the `id`
     * const localMatchWithIdOnly = await prisma.localMatch.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends LocalMatchCreateManyAndReturnArgs>(args?: SelectSubset<T, LocalMatchCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a LocalMatch.
     * @param {LocalMatchDeleteArgs} args - Arguments to delete one LocalMatch.
     * @example
     * // Delete one LocalMatch
     * const LocalMatch = await prisma.localMatch.delete({
     *   where: {
     *     // ... filter to delete one LocalMatch
     *   }
     * })
     * 
     */
    delete<T extends LocalMatchDeleteArgs>(args: SelectSubset<T, LocalMatchDeleteArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one LocalMatch.
     * @param {LocalMatchUpdateArgs} args - Arguments to update one LocalMatch.
     * @example
     * // Update one LocalMatch
     * const localMatch = await prisma.localMatch.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends LocalMatchUpdateArgs>(args: SelectSubset<T, LocalMatchUpdateArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more LocalMatches.
     * @param {LocalMatchDeleteManyArgs} args - Arguments to filter LocalMatches to delete.
     * @example
     * // Delete a few LocalMatches
     * const { count } = await prisma.localMatch.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends LocalMatchDeleteManyArgs>(args?: SelectSubset<T, LocalMatchDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LocalMatches.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many LocalMatches
     * const localMatch = await prisma.localMatch.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends LocalMatchUpdateManyArgs>(args: SelectSubset<T, LocalMatchUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LocalMatches and returns the data updated in the database.
     * @param {LocalMatchUpdateManyAndReturnArgs} args - Arguments to update many LocalMatches.
     * @example
     * // Update many LocalMatches
     * const localMatch = await prisma.localMatch.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more LocalMatches and only return the `id`
     * const localMatchWithIdOnly = await prisma.localMatch.updateManyAndReturn({
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
    updateManyAndReturn<T extends LocalMatchUpdateManyAndReturnArgs>(args: SelectSubset<T, LocalMatchUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one LocalMatch.
     * @param {LocalMatchUpsertArgs} args - Arguments to update or create a LocalMatch.
     * @example
     * // Update or create a LocalMatch
     * const localMatch = await prisma.localMatch.upsert({
     *   create: {
     *     // ... data to create a LocalMatch
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the LocalMatch we want to update
     *   }
     * })
     */
    upsert<T extends LocalMatchUpsertArgs>(args: SelectSubset<T, LocalMatchUpsertArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of LocalMatches.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchCountArgs} args - Arguments to filter LocalMatches to count.
     * @example
     * // Count the number of LocalMatches
     * const count = await prisma.localMatch.count({
     *   where: {
     *     // ... the filter for the LocalMatches we want to count
     *   }
     * })
    **/
    count<T extends LocalMatchCountArgs>(
      args?: Subset<T, LocalMatchCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LocalMatchCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a LocalMatch.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends LocalMatchAggregateArgs>(args: Subset<T, LocalMatchAggregateArgs>): Prisma.PrismaPromise<GetLocalMatchAggregateType<T>>

    /**
     * Group by LocalMatch.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchGroupByArgs} args - Group by arguments.
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
      T extends LocalMatchGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LocalMatchGroupByArgs['orderBy'] }
        : { orderBy?: LocalMatchGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, LocalMatchGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLocalMatchGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the LocalMatch model
   */
  readonly fields: LocalMatchFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for LocalMatch.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__LocalMatchClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    creator<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    teamA<T extends TeamDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TeamDefaultArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    teamB<T extends LocalMatch$teamBArgs<ExtArgs> = {}>(args?: Subset<T, LocalMatch$teamBArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    cup<T extends LocalMatch$cupArgs<ExtArgs> = {}>(args?: Subset<T, LocalMatch$cupArgs<ExtArgs>>): Prisma__CupClient<$Result.GetResult<Prisma.$CupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    actions<T extends LocalMatch$actionsArgs<ExtArgs> = {}>(args?: Subset<T, LocalMatch$actionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
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
   * Fields of the LocalMatch model
   */
  interface LocalMatchFieldRefs {
    readonly id: FieldRef<"LocalMatch", 'String'>
    readonly name: FieldRef<"LocalMatch", 'String'>
    readonly status: FieldRef<"LocalMatch", 'String'>
    readonly createdAt: FieldRef<"LocalMatch", 'DateTime'>
    readonly updatedAt: FieldRef<"LocalMatch", 'DateTime'>
    readonly startedAt: FieldRef<"LocalMatch", 'DateTime'>
    readonly completedAt: FieldRef<"LocalMatch", 'DateTime'>
    readonly creatorId: FieldRef<"LocalMatch", 'String'>
    readonly teamAId: FieldRef<"LocalMatch", 'String'>
    readonly teamBId: FieldRef<"LocalMatch", 'String'>
    readonly cupId: FieldRef<"LocalMatch", 'String'>
    readonly shareToken: FieldRef<"LocalMatch", 'String'>
    readonly teamAOwnerValidated: FieldRef<"LocalMatch", 'Boolean'>
    readonly teamBOwnerValidated: FieldRef<"LocalMatch", 'Boolean'>
    readonly gameState: FieldRef<"LocalMatch", 'Json'>
    readonly scoreTeamA: FieldRef<"LocalMatch", 'Int'>
    readonly scoreTeamB: FieldRef<"LocalMatch", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * LocalMatch findUnique
   */
  export type LocalMatchFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatch to fetch.
     */
    where: LocalMatchWhereUniqueInput
  }

  /**
   * LocalMatch findUniqueOrThrow
   */
  export type LocalMatchFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatch to fetch.
     */
    where: LocalMatchWhereUniqueInput
  }

  /**
   * LocalMatch findFirst
   */
  export type LocalMatchFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatch to fetch.
     */
    where?: LocalMatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatches to fetch.
     */
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LocalMatches.
     */
    cursor?: LocalMatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LocalMatches.
     */
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
  }

  /**
   * LocalMatch findFirstOrThrow
   */
  export type LocalMatchFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatch to fetch.
     */
    where?: LocalMatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatches to fetch.
     */
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LocalMatches.
     */
    cursor?: LocalMatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatches.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LocalMatches.
     */
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
  }

  /**
   * LocalMatch findMany
   */
  export type LocalMatchFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatches to fetch.
     */
    where?: LocalMatchWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatches to fetch.
     */
    orderBy?: LocalMatchOrderByWithRelationInput | LocalMatchOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing LocalMatches.
     */
    cursor?: LocalMatchWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatches from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatches.
     */
    skip?: number
    distinct?: LocalMatchScalarFieldEnum | LocalMatchScalarFieldEnum[]
  }

  /**
   * LocalMatch create
   */
  export type LocalMatchCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * The data needed to create a LocalMatch.
     */
    data: XOR<LocalMatchCreateInput, LocalMatchUncheckedCreateInput>
  }

  /**
   * LocalMatch createMany
   */
  export type LocalMatchCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many LocalMatches.
     */
    data: LocalMatchCreateManyInput | LocalMatchCreateManyInput[]
  }

  /**
   * LocalMatch createManyAndReturn
   */
  export type LocalMatchCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * The data used to create many LocalMatches.
     */
    data: LocalMatchCreateManyInput | LocalMatchCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * LocalMatch update
   */
  export type LocalMatchUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * The data needed to update a LocalMatch.
     */
    data: XOR<LocalMatchUpdateInput, LocalMatchUncheckedUpdateInput>
    /**
     * Choose, which LocalMatch to update.
     */
    where: LocalMatchWhereUniqueInput
  }

  /**
   * LocalMatch updateMany
   */
  export type LocalMatchUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update LocalMatches.
     */
    data: XOR<LocalMatchUpdateManyMutationInput, LocalMatchUncheckedUpdateManyInput>
    /**
     * Filter which LocalMatches to update
     */
    where?: LocalMatchWhereInput
    /**
     * Limit how many LocalMatches to update.
     */
    limit?: number
  }

  /**
   * LocalMatch updateManyAndReturn
   */
  export type LocalMatchUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * The data used to update LocalMatches.
     */
    data: XOR<LocalMatchUpdateManyMutationInput, LocalMatchUncheckedUpdateManyInput>
    /**
     * Filter which LocalMatches to update
     */
    where?: LocalMatchWhereInput
    /**
     * Limit how many LocalMatches to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * LocalMatch upsert
   */
  export type LocalMatchUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * The filter to search for the LocalMatch to update in case it exists.
     */
    where: LocalMatchWhereUniqueInput
    /**
     * In case the LocalMatch found by the `where` argument doesn't exist, create a new LocalMatch with this data.
     */
    create: XOR<LocalMatchCreateInput, LocalMatchUncheckedCreateInput>
    /**
     * In case the LocalMatch was found with the provided `where` argument, update it with this data.
     */
    update: XOR<LocalMatchUpdateInput, LocalMatchUncheckedUpdateInput>
  }

  /**
   * LocalMatch delete
   */
  export type LocalMatchDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
    /**
     * Filter which LocalMatch to delete.
     */
    where: LocalMatchWhereUniqueInput
  }

  /**
   * LocalMatch deleteMany
   */
  export type LocalMatchDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LocalMatches to delete
     */
    where?: LocalMatchWhereInput
    /**
     * Limit how many LocalMatches to delete.
     */
    limit?: number
  }

  /**
   * LocalMatch.teamB
   */
  export type LocalMatch$teamBArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
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
   * LocalMatch.cup
   */
  export type LocalMatch$cupArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cup
     */
    select?: CupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Cup
     */
    omit?: CupOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CupInclude<ExtArgs> | null
    where?: CupWhereInput
  }

  /**
   * LocalMatch.actions
   */
  export type LocalMatch$actionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    where?: LocalMatchActionWhereInput
    orderBy?: LocalMatchActionOrderByWithRelationInput | LocalMatchActionOrderByWithRelationInput[]
    cursor?: LocalMatchActionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: LocalMatchActionScalarFieldEnum | LocalMatchActionScalarFieldEnum[]
  }

  /**
   * LocalMatch without action
   */
  export type LocalMatchDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatch
     */
    select?: LocalMatchSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatch
     */
    omit?: LocalMatchOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchInclude<ExtArgs> | null
  }


  /**
   * Model LocalMatchAction
   */

  export type AggregateLocalMatchAction = {
    _count: LocalMatchActionCountAggregateOutputType | null
    _avg: LocalMatchActionAvgAggregateOutputType | null
    _sum: LocalMatchActionSumAggregateOutputType | null
    _min: LocalMatchActionMinAggregateOutputType | null
    _max: LocalMatchActionMaxAggregateOutputType | null
  }

  export type LocalMatchActionAvgAggregateOutputType = {
    half: number | null
    turn: number | null
    diceResult: number | null
  }

  export type LocalMatchActionSumAggregateOutputType = {
    half: number | null
    turn: number | null
    diceResult: number | null
  }

  export type LocalMatchActionMinAggregateOutputType = {
    id: string | null
    matchId: string | null
    half: number | null
    turn: number | null
    actionType: string | null
    playerId: string | null
    playerName: string | null
    playerTeam: string | null
    opponentId: string | null
    opponentName: string | null
    diceResult: number | null
    fumble: boolean | null
    playerState: string | null
    armorBroken: boolean | null
    opponentState: string | null
    passType: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LocalMatchActionMaxAggregateOutputType = {
    id: string | null
    matchId: string | null
    half: number | null
    turn: number | null
    actionType: string | null
    playerId: string | null
    playerName: string | null
    playerTeam: string | null
    opponentId: string | null
    opponentName: string | null
    diceResult: number | null
    fumble: boolean | null
    playerState: string | null
    armorBroken: boolean | null
    opponentState: string | null
    passType: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LocalMatchActionCountAggregateOutputType = {
    id: number
    matchId: number
    half: number
    turn: number
    actionType: number
    playerId: number
    playerName: number
    playerTeam: number
    opponentId: number
    opponentName: number
    diceResult: number
    fumble: number
    playerState: number
    armorBroken: number
    opponentState: number
    passType: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type LocalMatchActionAvgAggregateInputType = {
    half?: true
    turn?: true
    diceResult?: true
  }

  export type LocalMatchActionSumAggregateInputType = {
    half?: true
    turn?: true
    diceResult?: true
  }

  export type LocalMatchActionMinAggregateInputType = {
    id?: true
    matchId?: true
    half?: true
    turn?: true
    actionType?: true
    playerId?: true
    playerName?: true
    playerTeam?: true
    opponentId?: true
    opponentName?: true
    diceResult?: true
    fumble?: true
    playerState?: true
    armorBroken?: true
    opponentState?: true
    passType?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LocalMatchActionMaxAggregateInputType = {
    id?: true
    matchId?: true
    half?: true
    turn?: true
    actionType?: true
    playerId?: true
    playerName?: true
    playerTeam?: true
    opponentId?: true
    opponentName?: true
    diceResult?: true
    fumble?: true
    playerState?: true
    armorBroken?: true
    opponentState?: true
    passType?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LocalMatchActionCountAggregateInputType = {
    id?: true
    matchId?: true
    half?: true
    turn?: true
    actionType?: true
    playerId?: true
    playerName?: true
    playerTeam?: true
    opponentId?: true
    opponentName?: true
    diceResult?: true
    fumble?: true
    playerState?: true
    armorBroken?: true
    opponentState?: true
    passType?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type LocalMatchActionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LocalMatchAction to aggregate.
     */
    where?: LocalMatchActionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatchActions to fetch.
     */
    orderBy?: LocalMatchActionOrderByWithRelationInput | LocalMatchActionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: LocalMatchActionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatchActions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatchActions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned LocalMatchActions
    **/
    _count?: true | LocalMatchActionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: LocalMatchActionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: LocalMatchActionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LocalMatchActionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LocalMatchActionMaxAggregateInputType
  }

  export type GetLocalMatchActionAggregateType<T extends LocalMatchActionAggregateArgs> = {
        [P in keyof T & keyof AggregateLocalMatchAction]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLocalMatchAction[P]>
      : GetScalarType<T[P], AggregateLocalMatchAction[P]>
  }




  export type LocalMatchActionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocalMatchActionWhereInput
    orderBy?: LocalMatchActionOrderByWithAggregationInput | LocalMatchActionOrderByWithAggregationInput[]
    by: LocalMatchActionScalarFieldEnum[] | LocalMatchActionScalarFieldEnum
    having?: LocalMatchActionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LocalMatchActionCountAggregateInputType | true
    _avg?: LocalMatchActionAvgAggregateInputType
    _sum?: LocalMatchActionSumAggregateInputType
    _min?: LocalMatchActionMinAggregateInputType
    _max?: LocalMatchActionMaxAggregateInputType
  }

  export type LocalMatchActionGroupByOutputType = {
    id: string
    matchId: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId: string | null
    opponentName: string | null
    diceResult: number | null
    fumble: boolean
    playerState: string | null
    armorBroken: boolean
    opponentState: string | null
    passType: string | null
    createdAt: Date
    updatedAt: Date
    _count: LocalMatchActionCountAggregateOutputType | null
    _avg: LocalMatchActionAvgAggregateOutputType | null
    _sum: LocalMatchActionSumAggregateOutputType | null
    _min: LocalMatchActionMinAggregateOutputType | null
    _max: LocalMatchActionMaxAggregateOutputType | null
  }

  type GetLocalMatchActionGroupByPayload<T extends LocalMatchActionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<LocalMatchActionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LocalMatchActionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LocalMatchActionGroupByOutputType[P]>
            : GetScalarType<T[P], LocalMatchActionGroupByOutputType[P]>
        }
      >
    >


  export type LocalMatchActionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    half?: boolean
    turn?: boolean
    actionType?: boolean
    playerId?: boolean
    playerName?: boolean
    playerTeam?: boolean
    opponentId?: boolean
    opponentName?: boolean
    diceResult?: boolean
    fumble?: boolean
    playerState?: boolean
    armorBroken?: boolean
    opponentState?: boolean
    passType?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    match?: boolean | LocalMatchDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["localMatchAction"]>

  export type LocalMatchActionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    half?: boolean
    turn?: boolean
    actionType?: boolean
    playerId?: boolean
    playerName?: boolean
    playerTeam?: boolean
    opponentId?: boolean
    opponentName?: boolean
    diceResult?: boolean
    fumble?: boolean
    playerState?: boolean
    armorBroken?: boolean
    opponentState?: boolean
    passType?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    match?: boolean | LocalMatchDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["localMatchAction"]>

  export type LocalMatchActionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    matchId?: boolean
    half?: boolean
    turn?: boolean
    actionType?: boolean
    playerId?: boolean
    playerName?: boolean
    playerTeam?: boolean
    opponentId?: boolean
    opponentName?: boolean
    diceResult?: boolean
    fumble?: boolean
    playerState?: boolean
    armorBroken?: boolean
    opponentState?: boolean
    passType?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    match?: boolean | LocalMatchDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["localMatchAction"]>

  export type LocalMatchActionSelectScalar = {
    id?: boolean
    matchId?: boolean
    half?: boolean
    turn?: boolean
    actionType?: boolean
    playerId?: boolean
    playerName?: boolean
    playerTeam?: boolean
    opponentId?: boolean
    opponentName?: boolean
    diceResult?: boolean
    fumble?: boolean
    playerState?: boolean
    armorBroken?: boolean
    opponentState?: boolean
    passType?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type LocalMatchActionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "matchId" | "half" | "turn" | "actionType" | "playerId" | "playerName" | "playerTeam" | "opponentId" | "opponentName" | "diceResult" | "fumble" | "playerState" | "armorBroken" | "opponentState" | "passType" | "createdAt" | "updatedAt", ExtArgs["result"]["localMatchAction"]>
  export type LocalMatchActionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | LocalMatchDefaultArgs<ExtArgs>
  }
  export type LocalMatchActionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | LocalMatchDefaultArgs<ExtArgs>
  }
  export type LocalMatchActionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    match?: boolean | LocalMatchDefaultArgs<ExtArgs>
  }

  export type $LocalMatchActionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "LocalMatchAction"
    objects: {
      match: Prisma.$LocalMatchPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      matchId: string
      half: number
      turn: number
      actionType: string
      playerId: string
      playerName: string
      playerTeam: string
      opponentId: string | null
      opponentName: string | null
      diceResult: number | null
      fumble: boolean
      playerState: string | null
      armorBroken: boolean
      opponentState: string | null
      passType: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["localMatchAction"]>
    composites: {}
  }

  type LocalMatchActionGetPayload<S extends boolean | null | undefined | LocalMatchActionDefaultArgs> = $Result.GetResult<Prisma.$LocalMatchActionPayload, S>

  type LocalMatchActionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<LocalMatchActionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: LocalMatchActionCountAggregateInputType | true
    }

  export interface LocalMatchActionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['LocalMatchAction'], meta: { name: 'LocalMatchAction' } }
    /**
     * Find zero or one LocalMatchAction that matches the filter.
     * @param {LocalMatchActionFindUniqueArgs} args - Arguments to find a LocalMatchAction
     * @example
     * // Get one LocalMatchAction
     * const localMatchAction = await prisma.localMatchAction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends LocalMatchActionFindUniqueArgs>(args: SelectSubset<T, LocalMatchActionFindUniqueArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one LocalMatchAction that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {LocalMatchActionFindUniqueOrThrowArgs} args - Arguments to find a LocalMatchAction
     * @example
     * // Get one LocalMatchAction
     * const localMatchAction = await prisma.localMatchAction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends LocalMatchActionFindUniqueOrThrowArgs>(args: SelectSubset<T, LocalMatchActionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LocalMatchAction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionFindFirstArgs} args - Arguments to find a LocalMatchAction
     * @example
     * // Get one LocalMatchAction
     * const localMatchAction = await prisma.localMatchAction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends LocalMatchActionFindFirstArgs>(args?: SelectSubset<T, LocalMatchActionFindFirstArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LocalMatchAction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionFindFirstOrThrowArgs} args - Arguments to find a LocalMatchAction
     * @example
     * // Get one LocalMatchAction
     * const localMatchAction = await prisma.localMatchAction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends LocalMatchActionFindFirstOrThrowArgs>(args?: SelectSubset<T, LocalMatchActionFindFirstOrThrowArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more LocalMatchActions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all LocalMatchActions
     * const localMatchActions = await prisma.localMatchAction.findMany()
     * 
     * // Get first 10 LocalMatchActions
     * const localMatchActions = await prisma.localMatchAction.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const localMatchActionWithIdOnly = await prisma.localMatchAction.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends LocalMatchActionFindManyArgs>(args?: SelectSubset<T, LocalMatchActionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a LocalMatchAction.
     * @param {LocalMatchActionCreateArgs} args - Arguments to create a LocalMatchAction.
     * @example
     * // Create one LocalMatchAction
     * const LocalMatchAction = await prisma.localMatchAction.create({
     *   data: {
     *     // ... data to create a LocalMatchAction
     *   }
     * })
     * 
     */
    create<T extends LocalMatchActionCreateArgs>(args: SelectSubset<T, LocalMatchActionCreateArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many LocalMatchActions.
     * @param {LocalMatchActionCreateManyArgs} args - Arguments to create many LocalMatchActions.
     * @example
     * // Create many LocalMatchActions
     * const localMatchAction = await prisma.localMatchAction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends LocalMatchActionCreateManyArgs>(args?: SelectSubset<T, LocalMatchActionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many LocalMatchActions and returns the data saved in the database.
     * @param {LocalMatchActionCreateManyAndReturnArgs} args - Arguments to create many LocalMatchActions.
     * @example
     * // Create many LocalMatchActions
     * const localMatchAction = await prisma.localMatchAction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many LocalMatchActions and only return the `id`
     * const localMatchActionWithIdOnly = await prisma.localMatchAction.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends LocalMatchActionCreateManyAndReturnArgs>(args?: SelectSubset<T, LocalMatchActionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a LocalMatchAction.
     * @param {LocalMatchActionDeleteArgs} args - Arguments to delete one LocalMatchAction.
     * @example
     * // Delete one LocalMatchAction
     * const LocalMatchAction = await prisma.localMatchAction.delete({
     *   where: {
     *     // ... filter to delete one LocalMatchAction
     *   }
     * })
     * 
     */
    delete<T extends LocalMatchActionDeleteArgs>(args: SelectSubset<T, LocalMatchActionDeleteArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one LocalMatchAction.
     * @param {LocalMatchActionUpdateArgs} args - Arguments to update one LocalMatchAction.
     * @example
     * // Update one LocalMatchAction
     * const localMatchAction = await prisma.localMatchAction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends LocalMatchActionUpdateArgs>(args: SelectSubset<T, LocalMatchActionUpdateArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more LocalMatchActions.
     * @param {LocalMatchActionDeleteManyArgs} args - Arguments to filter LocalMatchActions to delete.
     * @example
     * // Delete a few LocalMatchActions
     * const { count } = await prisma.localMatchAction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends LocalMatchActionDeleteManyArgs>(args?: SelectSubset<T, LocalMatchActionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LocalMatchActions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many LocalMatchActions
     * const localMatchAction = await prisma.localMatchAction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends LocalMatchActionUpdateManyArgs>(args: SelectSubset<T, LocalMatchActionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LocalMatchActions and returns the data updated in the database.
     * @param {LocalMatchActionUpdateManyAndReturnArgs} args - Arguments to update many LocalMatchActions.
     * @example
     * // Update many LocalMatchActions
     * const localMatchAction = await prisma.localMatchAction.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more LocalMatchActions and only return the `id`
     * const localMatchActionWithIdOnly = await prisma.localMatchAction.updateManyAndReturn({
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
    updateManyAndReturn<T extends LocalMatchActionUpdateManyAndReturnArgs>(args: SelectSubset<T, LocalMatchActionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one LocalMatchAction.
     * @param {LocalMatchActionUpsertArgs} args - Arguments to update or create a LocalMatchAction.
     * @example
     * // Update or create a LocalMatchAction
     * const localMatchAction = await prisma.localMatchAction.upsert({
     *   create: {
     *     // ... data to create a LocalMatchAction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the LocalMatchAction we want to update
     *   }
     * })
     */
    upsert<T extends LocalMatchActionUpsertArgs>(args: SelectSubset<T, LocalMatchActionUpsertArgs<ExtArgs>>): Prisma__LocalMatchActionClient<$Result.GetResult<Prisma.$LocalMatchActionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of LocalMatchActions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionCountArgs} args - Arguments to filter LocalMatchActions to count.
     * @example
     * // Count the number of LocalMatchActions
     * const count = await prisma.localMatchAction.count({
     *   where: {
     *     // ... the filter for the LocalMatchActions we want to count
     *   }
     * })
    **/
    count<T extends LocalMatchActionCountArgs>(
      args?: Subset<T, LocalMatchActionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LocalMatchActionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a LocalMatchAction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends LocalMatchActionAggregateArgs>(args: Subset<T, LocalMatchActionAggregateArgs>): Prisma.PrismaPromise<GetLocalMatchActionAggregateType<T>>

    /**
     * Group by LocalMatchAction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocalMatchActionGroupByArgs} args - Group by arguments.
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
      T extends LocalMatchActionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LocalMatchActionGroupByArgs['orderBy'] }
        : { orderBy?: LocalMatchActionGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, LocalMatchActionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLocalMatchActionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the LocalMatchAction model
   */
  readonly fields: LocalMatchActionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for LocalMatchAction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__LocalMatchActionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    match<T extends LocalMatchDefaultArgs<ExtArgs> = {}>(args?: Subset<T, LocalMatchDefaultArgs<ExtArgs>>): Prisma__LocalMatchClient<$Result.GetResult<Prisma.$LocalMatchPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
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
   * Fields of the LocalMatchAction model
   */
  interface LocalMatchActionFieldRefs {
    readonly id: FieldRef<"LocalMatchAction", 'String'>
    readonly matchId: FieldRef<"LocalMatchAction", 'String'>
    readonly half: FieldRef<"LocalMatchAction", 'Int'>
    readonly turn: FieldRef<"LocalMatchAction", 'Int'>
    readonly actionType: FieldRef<"LocalMatchAction", 'String'>
    readonly playerId: FieldRef<"LocalMatchAction", 'String'>
    readonly playerName: FieldRef<"LocalMatchAction", 'String'>
    readonly playerTeam: FieldRef<"LocalMatchAction", 'String'>
    readonly opponentId: FieldRef<"LocalMatchAction", 'String'>
    readonly opponentName: FieldRef<"LocalMatchAction", 'String'>
    readonly diceResult: FieldRef<"LocalMatchAction", 'Int'>
    readonly fumble: FieldRef<"LocalMatchAction", 'Boolean'>
    readonly playerState: FieldRef<"LocalMatchAction", 'String'>
    readonly armorBroken: FieldRef<"LocalMatchAction", 'Boolean'>
    readonly opponentState: FieldRef<"LocalMatchAction", 'String'>
    readonly passType: FieldRef<"LocalMatchAction", 'String'>
    readonly createdAt: FieldRef<"LocalMatchAction", 'DateTime'>
    readonly updatedAt: FieldRef<"LocalMatchAction", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * LocalMatchAction findUnique
   */
  export type LocalMatchActionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatchAction to fetch.
     */
    where: LocalMatchActionWhereUniqueInput
  }

  /**
   * LocalMatchAction findUniqueOrThrow
   */
  export type LocalMatchActionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatchAction to fetch.
     */
    where: LocalMatchActionWhereUniqueInput
  }

  /**
   * LocalMatchAction findFirst
   */
  export type LocalMatchActionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatchAction to fetch.
     */
    where?: LocalMatchActionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatchActions to fetch.
     */
    orderBy?: LocalMatchActionOrderByWithRelationInput | LocalMatchActionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LocalMatchActions.
     */
    cursor?: LocalMatchActionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatchActions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatchActions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LocalMatchActions.
     */
    distinct?: LocalMatchActionScalarFieldEnum | LocalMatchActionScalarFieldEnum[]
  }

  /**
   * LocalMatchAction findFirstOrThrow
   */
  export type LocalMatchActionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatchAction to fetch.
     */
    where?: LocalMatchActionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatchActions to fetch.
     */
    orderBy?: LocalMatchActionOrderByWithRelationInput | LocalMatchActionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LocalMatchActions.
     */
    cursor?: LocalMatchActionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatchActions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatchActions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LocalMatchActions.
     */
    distinct?: LocalMatchActionScalarFieldEnum | LocalMatchActionScalarFieldEnum[]
  }

  /**
   * LocalMatchAction findMany
   */
  export type LocalMatchActionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * Filter, which LocalMatchActions to fetch.
     */
    where?: LocalMatchActionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LocalMatchActions to fetch.
     */
    orderBy?: LocalMatchActionOrderByWithRelationInput | LocalMatchActionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing LocalMatchActions.
     */
    cursor?: LocalMatchActionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LocalMatchActions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LocalMatchActions.
     */
    skip?: number
    distinct?: LocalMatchActionScalarFieldEnum | LocalMatchActionScalarFieldEnum[]
  }

  /**
   * LocalMatchAction create
   */
  export type LocalMatchActionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * The data needed to create a LocalMatchAction.
     */
    data: XOR<LocalMatchActionCreateInput, LocalMatchActionUncheckedCreateInput>
  }

  /**
   * LocalMatchAction createMany
   */
  export type LocalMatchActionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many LocalMatchActions.
     */
    data: LocalMatchActionCreateManyInput | LocalMatchActionCreateManyInput[]
  }

  /**
   * LocalMatchAction createManyAndReturn
   */
  export type LocalMatchActionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * The data used to create many LocalMatchActions.
     */
    data: LocalMatchActionCreateManyInput | LocalMatchActionCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * LocalMatchAction update
   */
  export type LocalMatchActionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * The data needed to update a LocalMatchAction.
     */
    data: XOR<LocalMatchActionUpdateInput, LocalMatchActionUncheckedUpdateInput>
    /**
     * Choose, which LocalMatchAction to update.
     */
    where: LocalMatchActionWhereUniqueInput
  }

  /**
   * LocalMatchAction updateMany
   */
  export type LocalMatchActionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update LocalMatchActions.
     */
    data: XOR<LocalMatchActionUpdateManyMutationInput, LocalMatchActionUncheckedUpdateManyInput>
    /**
     * Filter which LocalMatchActions to update
     */
    where?: LocalMatchActionWhereInput
    /**
     * Limit how many LocalMatchActions to update.
     */
    limit?: number
  }

  /**
   * LocalMatchAction updateManyAndReturn
   */
  export type LocalMatchActionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * The data used to update LocalMatchActions.
     */
    data: XOR<LocalMatchActionUpdateManyMutationInput, LocalMatchActionUncheckedUpdateManyInput>
    /**
     * Filter which LocalMatchActions to update
     */
    where?: LocalMatchActionWhereInput
    /**
     * Limit how many LocalMatchActions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * LocalMatchAction upsert
   */
  export type LocalMatchActionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * The filter to search for the LocalMatchAction to update in case it exists.
     */
    where: LocalMatchActionWhereUniqueInput
    /**
     * In case the LocalMatchAction found by the `where` argument doesn't exist, create a new LocalMatchAction with this data.
     */
    create: XOR<LocalMatchActionCreateInput, LocalMatchActionUncheckedCreateInput>
    /**
     * In case the LocalMatchAction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<LocalMatchActionUpdateInput, LocalMatchActionUncheckedUpdateInput>
  }

  /**
   * LocalMatchAction delete
   */
  export type LocalMatchActionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
    /**
     * Filter which LocalMatchAction to delete.
     */
    where: LocalMatchActionWhereUniqueInput
  }

  /**
   * LocalMatchAction deleteMany
   */
  export type LocalMatchActionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LocalMatchActions to delete
     */
    where?: LocalMatchActionWhereInput
    /**
     * Limit how many LocalMatchActions to delete.
     */
    limit?: number
  }

  /**
   * LocalMatchAction without action
   */
  export type LocalMatchActionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocalMatchAction
     */
    select?: LocalMatchActionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LocalMatchAction
     */
    omit?: LocalMatchActionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocalMatchActionInclude<ExtArgs> | null
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
    coachName: 'coachName',
    firstName: 'firstName',
    lastName: 'lastName',
    dateOfBirth: 'dateOfBirth',
    role: 'role',
    roles: 'roles',
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
    createdAt: 'createdAt',
    treasury: 'treasury',
    rerolls: 'rerolls',
    cheerleaders: 'cheerleaders',
    assistants: 'assistants',
    apothecary: 'apothecary',
    dedicatedFans: 'dedicatedFans',
    teamValue: 'teamValue',
    currentValue: 'currentValue',
    initialBudget: 'initialBudget'
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


  export const CupScalarFieldEnum: {
    id: 'id',
    name: 'name',
    creatorId: 'creatorId',
    validated: 'validated',
    isPublic: 'isPublic',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CupScalarFieldEnum = (typeof CupScalarFieldEnum)[keyof typeof CupScalarFieldEnum]


  export const CupParticipantScalarFieldEnum: {
    id: 'id',
    cupId: 'cupId',
    teamId: 'teamId',
    createdAt: 'createdAt'
  };

  export type CupParticipantScalarFieldEnum = (typeof CupParticipantScalarFieldEnum)[keyof typeof CupParticipantScalarFieldEnum]


  export const LocalMatchScalarFieldEnum: {
    id: 'id',
    name: 'name',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    creatorId: 'creatorId',
    teamAId: 'teamAId',
    teamBId: 'teamBId',
    cupId: 'cupId',
    shareToken: 'shareToken',
    teamAOwnerValidated: 'teamAOwnerValidated',
    teamBOwnerValidated: 'teamBOwnerValidated',
    gameState: 'gameState',
    scoreTeamA: 'scoreTeamA',
    scoreTeamB: 'scoreTeamB'
  };

  export type LocalMatchScalarFieldEnum = (typeof LocalMatchScalarFieldEnum)[keyof typeof LocalMatchScalarFieldEnum]


  export const LocalMatchActionScalarFieldEnum: {
    id: 'id',
    matchId: 'matchId',
    half: 'half',
    turn: 'turn',
    actionType: 'actionType',
    playerId: 'playerId',
    playerName: 'playerName',
    playerTeam: 'playerTeam',
    opponentId: 'opponentId',
    opponentName: 'opponentName',
    diceResult: 'diceResult',
    fumble: 'fumble',
    playerState: 'playerState',
    armorBroken: 'armorBroken',
    opponentState: 'opponentState',
    passType: 'passType',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type LocalMatchActionScalarFieldEnum = (typeof LocalMatchActionScalarFieldEnum)[keyof typeof LocalMatchActionScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


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
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


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
    coachName?: StringFilter<"User"> | string
    firstName?: StringNullableFilter<"User"> | string | null
    lastName?: StringNullableFilter<"User"> | string | null
    dateOfBirth?: DateTimeNullableFilter<"User"> | Date | string | null
    role?: StringFilter<"User"> | string
    roles?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    matches?: MatchListRelationFilter
    createdMatches?: MatchListRelationFilter
    teams?: TeamListRelationFilter
    teamSelections?: TeamSelectionListRelationFilter
    createdCups?: CupListRelationFilter
    createdLocalMatches?: LocalMatchListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrderInput | SortOrder
    coachName?: SortOrder
    firstName?: SortOrderInput | SortOrder
    lastName?: SortOrderInput | SortOrder
    dateOfBirth?: SortOrderInput | SortOrder
    role?: SortOrder
    roles?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    matches?: MatchOrderByRelationAggregateInput
    createdMatches?: MatchOrderByRelationAggregateInput
    teams?: TeamOrderByRelationAggregateInput
    teamSelections?: TeamSelectionOrderByRelationAggregateInput
    createdCups?: CupOrderByRelationAggregateInput
    createdLocalMatches?: LocalMatchOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    passwordHash?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    coachName?: StringFilter<"User"> | string
    firstName?: StringNullableFilter<"User"> | string | null
    lastName?: StringNullableFilter<"User"> | string | null
    dateOfBirth?: DateTimeNullableFilter<"User"> | Date | string | null
    role?: StringFilter<"User"> | string
    roles?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    matches?: MatchListRelationFilter
    createdMatches?: MatchListRelationFilter
    teams?: TeamListRelationFilter
    teamSelections?: TeamSelectionListRelationFilter
    createdCups?: CupListRelationFilter
    createdLocalMatches?: LocalMatchListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrderInput | SortOrder
    coachName?: SortOrder
    firstName?: SortOrderInput | SortOrder
    lastName?: SortOrderInput | SortOrder
    dateOfBirth?: SortOrderInput | SortOrder
    role?: SortOrder
    roles?: SortOrder
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
    coachName?: StringWithAggregatesFilter<"User"> | string
    firstName?: StringNullableWithAggregatesFilter<"User"> | string | null
    lastName?: StringNullableWithAggregatesFilter<"User"> | string | null
    dateOfBirth?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    role?: StringWithAggregatesFilter<"User"> | string
    roles?: StringWithAggregatesFilter<"User"> | string
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
    team?: StringNullableFilter<"TeamSelection"> | string | null
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
    team?: SortOrderInput | SortOrder
    teamId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    match?: MatchOrderByWithRelationInput
    user?: UserOrderByWithRelationInput
    teamRef?: TeamOrderByWithRelationInput
  }

  export type TeamSelectionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    matchId_userId?: TeamSelectionMatchIdUserIdCompoundUniqueInput
    matchId_teamId?: TeamSelectionMatchIdTeamIdCompoundUniqueInput
    AND?: TeamSelectionWhereInput | TeamSelectionWhereInput[]
    OR?: TeamSelectionWhereInput[]
    NOT?: TeamSelectionWhereInput | TeamSelectionWhereInput[]
    matchId?: StringFilter<"TeamSelection"> | string
    userId?: StringFilter<"TeamSelection"> | string
    team?: StringNullableFilter<"TeamSelection"> | string | null
    teamId?: StringNullableFilter<"TeamSelection"> | string | null
    createdAt?: DateTimeFilter<"TeamSelection"> | Date | string
    match?: XOR<MatchScalarRelationFilter, MatchWhereInput>
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    teamRef?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
  }, "id" | "matchId_userId" | "matchId_teamId">

  export type TeamSelectionOrderByWithAggregationInput = {
    id?: SortOrder
    matchId?: SortOrder
    userId?: SortOrder
    team?: SortOrderInput | SortOrder
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
    team?: StringNullableWithAggregatesFilter<"TeamSelection"> | string | null
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
    treasury?: IntFilter<"Team"> | number
    rerolls?: IntFilter<"Team"> | number
    cheerleaders?: IntFilter<"Team"> | number
    assistants?: IntFilter<"Team"> | number
    apothecary?: BoolFilter<"Team"> | boolean
    dedicatedFans?: IntFilter<"Team"> | number
    teamValue?: IntFilter<"Team"> | number
    currentValue?: IntFilter<"Team"> | number
    initialBudget?: IntFilter<"Team"> | number
    owner?: XOR<UserScalarRelationFilter, UserWhereInput>
    players?: TeamPlayerListRelationFilter
    selections?: TeamSelectionListRelationFilter
    cupParticipants?: CupParticipantListRelationFilter
    localMatchesAsTeamA?: LocalMatchListRelationFilter
    localMatchesAsTeamB?: LocalMatchListRelationFilter
  }

  export type TeamOrderByWithRelationInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    apothecary?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
    owner?: UserOrderByWithRelationInput
    players?: TeamPlayerOrderByRelationAggregateInput
    selections?: TeamSelectionOrderByRelationAggregateInput
    cupParticipants?: CupParticipantOrderByRelationAggregateInput
    localMatchesAsTeamA?: LocalMatchOrderByRelationAggregateInput
    localMatchesAsTeamB?: LocalMatchOrderByRelationAggregateInput
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
    treasury?: IntFilter<"Team"> | number
    rerolls?: IntFilter<"Team"> | number
    cheerleaders?: IntFilter<"Team"> | number
    assistants?: IntFilter<"Team"> | number
    apothecary?: BoolFilter<"Team"> | boolean
    dedicatedFans?: IntFilter<"Team"> | number
    teamValue?: IntFilter<"Team"> | number
    currentValue?: IntFilter<"Team"> | number
    initialBudget?: IntFilter<"Team"> | number
    owner?: XOR<UserScalarRelationFilter, UserWhereInput>
    players?: TeamPlayerListRelationFilter
    selections?: TeamSelectionListRelationFilter
    cupParticipants?: CupParticipantListRelationFilter
    localMatchesAsTeamA?: LocalMatchListRelationFilter
    localMatchesAsTeamB?: LocalMatchListRelationFilter
  }, "id">

  export type TeamOrderByWithAggregationInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    apothecary?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
    _count?: TeamCountOrderByAggregateInput
    _avg?: TeamAvgOrderByAggregateInput
    _max?: TeamMaxOrderByAggregateInput
    _min?: TeamMinOrderByAggregateInput
    _sum?: TeamSumOrderByAggregateInput
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
    treasury?: IntWithAggregatesFilter<"Team"> | number
    rerolls?: IntWithAggregatesFilter<"Team"> | number
    cheerleaders?: IntWithAggregatesFilter<"Team"> | number
    assistants?: IntWithAggregatesFilter<"Team"> | number
    apothecary?: BoolWithAggregatesFilter<"Team"> | boolean
    dedicatedFans?: IntWithAggregatesFilter<"Team"> | number
    teamValue?: IntWithAggregatesFilter<"Team"> | number
    currentValue?: IntWithAggregatesFilter<"Team"> | number
    initialBudget?: IntWithAggregatesFilter<"Team"> | number
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

  export type CupWhereInput = {
    AND?: CupWhereInput | CupWhereInput[]
    OR?: CupWhereInput[]
    NOT?: CupWhereInput | CupWhereInput[]
    id?: StringFilter<"Cup"> | string
    name?: StringFilter<"Cup"> | string
    creatorId?: StringFilter<"Cup"> | string
    validated?: BoolFilter<"Cup"> | boolean
    isPublic?: BoolFilter<"Cup"> | boolean
    status?: StringFilter<"Cup"> | string
    createdAt?: DateTimeFilter<"Cup"> | Date | string
    updatedAt?: DateTimeFilter<"Cup"> | Date | string
    creator?: XOR<UserScalarRelationFilter, UserWhereInput>
    participants?: CupParticipantListRelationFilter
    localMatches?: LocalMatchListRelationFilter
  }

  export type CupOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    creatorId?: SortOrder
    validated?: SortOrder
    isPublic?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    creator?: UserOrderByWithRelationInput
    participants?: CupParticipantOrderByRelationAggregateInput
    localMatches?: LocalMatchOrderByRelationAggregateInput
  }

  export type CupWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CupWhereInput | CupWhereInput[]
    OR?: CupWhereInput[]
    NOT?: CupWhereInput | CupWhereInput[]
    name?: StringFilter<"Cup"> | string
    creatorId?: StringFilter<"Cup"> | string
    validated?: BoolFilter<"Cup"> | boolean
    isPublic?: BoolFilter<"Cup"> | boolean
    status?: StringFilter<"Cup"> | string
    createdAt?: DateTimeFilter<"Cup"> | Date | string
    updatedAt?: DateTimeFilter<"Cup"> | Date | string
    creator?: XOR<UserScalarRelationFilter, UserWhereInput>
    participants?: CupParticipantListRelationFilter
    localMatches?: LocalMatchListRelationFilter
  }, "id">

  export type CupOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    creatorId?: SortOrder
    validated?: SortOrder
    isPublic?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CupCountOrderByAggregateInput
    _max?: CupMaxOrderByAggregateInput
    _min?: CupMinOrderByAggregateInput
  }

  export type CupScalarWhereWithAggregatesInput = {
    AND?: CupScalarWhereWithAggregatesInput | CupScalarWhereWithAggregatesInput[]
    OR?: CupScalarWhereWithAggregatesInput[]
    NOT?: CupScalarWhereWithAggregatesInput | CupScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Cup"> | string
    name?: StringWithAggregatesFilter<"Cup"> | string
    creatorId?: StringWithAggregatesFilter<"Cup"> | string
    validated?: BoolWithAggregatesFilter<"Cup"> | boolean
    isPublic?: BoolWithAggregatesFilter<"Cup"> | boolean
    status?: StringWithAggregatesFilter<"Cup"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Cup"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Cup"> | Date | string
  }

  export type CupParticipantWhereInput = {
    AND?: CupParticipantWhereInput | CupParticipantWhereInput[]
    OR?: CupParticipantWhereInput[]
    NOT?: CupParticipantWhereInput | CupParticipantWhereInput[]
    id?: StringFilter<"CupParticipant"> | string
    cupId?: StringFilter<"CupParticipant"> | string
    teamId?: StringFilter<"CupParticipant"> | string
    createdAt?: DateTimeFilter<"CupParticipant"> | Date | string
    cup?: XOR<CupScalarRelationFilter, CupWhereInput>
    team?: XOR<TeamScalarRelationFilter, TeamWhereInput>
  }

  export type CupParticipantOrderByWithRelationInput = {
    id?: SortOrder
    cupId?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
    cup?: CupOrderByWithRelationInput
    team?: TeamOrderByWithRelationInput
  }

  export type CupParticipantWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    cupId_teamId?: CupParticipantCupIdTeamIdCompoundUniqueInput
    AND?: CupParticipantWhereInput | CupParticipantWhereInput[]
    OR?: CupParticipantWhereInput[]
    NOT?: CupParticipantWhereInput | CupParticipantWhereInput[]
    cupId?: StringFilter<"CupParticipant"> | string
    teamId?: StringFilter<"CupParticipant"> | string
    createdAt?: DateTimeFilter<"CupParticipant"> | Date | string
    cup?: XOR<CupScalarRelationFilter, CupWhereInput>
    team?: XOR<TeamScalarRelationFilter, TeamWhereInput>
  }, "id" | "cupId_teamId">

  export type CupParticipantOrderByWithAggregationInput = {
    id?: SortOrder
    cupId?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
    _count?: CupParticipantCountOrderByAggregateInput
    _max?: CupParticipantMaxOrderByAggregateInput
    _min?: CupParticipantMinOrderByAggregateInput
  }

  export type CupParticipantScalarWhereWithAggregatesInput = {
    AND?: CupParticipantScalarWhereWithAggregatesInput | CupParticipantScalarWhereWithAggregatesInput[]
    OR?: CupParticipantScalarWhereWithAggregatesInput[]
    NOT?: CupParticipantScalarWhereWithAggregatesInput | CupParticipantScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CupParticipant"> | string
    cupId?: StringWithAggregatesFilter<"CupParticipant"> | string
    teamId?: StringWithAggregatesFilter<"CupParticipant"> | string
    createdAt?: DateTimeWithAggregatesFilter<"CupParticipant"> | Date | string
  }

  export type LocalMatchWhereInput = {
    AND?: LocalMatchWhereInput | LocalMatchWhereInput[]
    OR?: LocalMatchWhereInput[]
    NOT?: LocalMatchWhereInput | LocalMatchWhereInput[]
    id?: StringFilter<"LocalMatch"> | string
    name?: StringNullableFilter<"LocalMatch"> | string | null
    status?: StringFilter<"LocalMatch"> | string
    createdAt?: DateTimeFilter<"LocalMatch"> | Date | string
    updatedAt?: DateTimeFilter<"LocalMatch"> | Date | string
    startedAt?: DateTimeNullableFilter<"LocalMatch"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"LocalMatch"> | Date | string | null
    creatorId?: StringFilter<"LocalMatch"> | string
    teamAId?: StringFilter<"LocalMatch"> | string
    teamBId?: StringNullableFilter<"LocalMatch"> | string | null
    cupId?: StringNullableFilter<"LocalMatch"> | string | null
    shareToken?: StringNullableFilter<"LocalMatch"> | string | null
    teamAOwnerValidated?: BoolFilter<"LocalMatch"> | boolean
    teamBOwnerValidated?: BoolFilter<"LocalMatch"> | boolean
    gameState?: JsonNullableFilter<"LocalMatch">
    scoreTeamA?: IntNullableFilter<"LocalMatch"> | number | null
    scoreTeamB?: IntNullableFilter<"LocalMatch"> | number | null
    creator?: XOR<UserScalarRelationFilter, UserWhereInput>
    teamA?: XOR<TeamScalarRelationFilter, TeamWhereInput>
    teamB?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
    cup?: XOR<CupNullableScalarRelationFilter, CupWhereInput> | null
    actions?: LocalMatchActionListRelationFilter
  }

  export type LocalMatchOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    creatorId?: SortOrder
    teamAId?: SortOrder
    teamBId?: SortOrderInput | SortOrder
    cupId?: SortOrderInput | SortOrder
    shareToken?: SortOrderInput | SortOrder
    teamAOwnerValidated?: SortOrder
    teamBOwnerValidated?: SortOrder
    gameState?: SortOrderInput | SortOrder
    scoreTeamA?: SortOrderInput | SortOrder
    scoreTeamB?: SortOrderInput | SortOrder
    creator?: UserOrderByWithRelationInput
    teamA?: TeamOrderByWithRelationInput
    teamB?: TeamOrderByWithRelationInput
    cup?: CupOrderByWithRelationInput
    actions?: LocalMatchActionOrderByRelationAggregateInput
  }

  export type LocalMatchWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    shareToken?: string
    AND?: LocalMatchWhereInput | LocalMatchWhereInput[]
    OR?: LocalMatchWhereInput[]
    NOT?: LocalMatchWhereInput | LocalMatchWhereInput[]
    name?: StringNullableFilter<"LocalMatch"> | string | null
    status?: StringFilter<"LocalMatch"> | string
    createdAt?: DateTimeFilter<"LocalMatch"> | Date | string
    updatedAt?: DateTimeFilter<"LocalMatch"> | Date | string
    startedAt?: DateTimeNullableFilter<"LocalMatch"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"LocalMatch"> | Date | string | null
    creatorId?: StringFilter<"LocalMatch"> | string
    teamAId?: StringFilter<"LocalMatch"> | string
    teamBId?: StringNullableFilter<"LocalMatch"> | string | null
    cupId?: StringNullableFilter<"LocalMatch"> | string | null
    teamAOwnerValidated?: BoolFilter<"LocalMatch"> | boolean
    teamBOwnerValidated?: BoolFilter<"LocalMatch"> | boolean
    gameState?: JsonNullableFilter<"LocalMatch">
    scoreTeamA?: IntNullableFilter<"LocalMatch"> | number | null
    scoreTeamB?: IntNullableFilter<"LocalMatch"> | number | null
    creator?: XOR<UserScalarRelationFilter, UserWhereInput>
    teamA?: XOR<TeamScalarRelationFilter, TeamWhereInput>
    teamB?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
    cup?: XOR<CupNullableScalarRelationFilter, CupWhereInput> | null
    actions?: LocalMatchActionListRelationFilter
  }, "id" | "shareToken">

  export type LocalMatchOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    creatorId?: SortOrder
    teamAId?: SortOrder
    teamBId?: SortOrderInput | SortOrder
    cupId?: SortOrderInput | SortOrder
    shareToken?: SortOrderInput | SortOrder
    teamAOwnerValidated?: SortOrder
    teamBOwnerValidated?: SortOrder
    gameState?: SortOrderInput | SortOrder
    scoreTeamA?: SortOrderInput | SortOrder
    scoreTeamB?: SortOrderInput | SortOrder
    _count?: LocalMatchCountOrderByAggregateInput
    _avg?: LocalMatchAvgOrderByAggregateInput
    _max?: LocalMatchMaxOrderByAggregateInput
    _min?: LocalMatchMinOrderByAggregateInput
    _sum?: LocalMatchSumOrderByAggregateInput
  }

  export type LocalMatchScalarWhereWithAggregatesInput = {
    AND?: LocalMatchScalarWhereWithAggregatesInput | LocalMatchScalarWhereWithAggregatesInput[]
    OR?: LocalMatchScalarWhereWithAggregatesInput[]
    NOT?: LocalMatchScalarWhereWithAggregatesInput | LocalMatchScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"LocalMatch"> | string
    name?: StringNullableWithAggregatesFilter<"LocalMatch"> | string | null
    status?: StringWithAggregatesFilter<"LocalMatch"> | string
    createdAt?: DateTimeWithAggregatesFilter<"LocalMatch"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"LocalMatch"> | Date | string
    startedAt?: DateTimeNullableWithAggregatesFilter<"LocalMatch"> | Date | string | null
    completedAt?: DateTimeNullableWithAggregatesFilter<"LocalMatch"> | Date | string | null
    creatorId?: StringWithAggregatesFilter<"LocalMatch"> | string
    teamAId?: StringWithAggregatesFilter<"LocalMatch"> | string
    teamBId?: StringNullableWithAggregatesFilter<"LocalMatch"> | string | null
    cupId?: StringNullableWithAggregatesFilter<"LocalMatch"> | string | null
    shareToken?: StringNullableWithAggregatesFilter<"LocalMatch"> | string | null
    teamAOwnerValidated?: BoolWithAggregatesFilter<"LocalMatch"> | boolean
    teamBOwnerValidated?: BoolWithAggregatesFilter<"LocalMatch"> | boolean
    gameState?: JsonNullableWithAggregatesFilter<"LocalMatch">
    scoreTeamA?: IntNullableWithAggregatesFilter<"LocalMatch"> | number | null
    scoreTeamB?: IntNullableWithAggregatesFilter<"LocalMatch"> | number | null
  }

  export type LocalMatchActionWhereInput = {
    AND?: LocalMatchActionWhereInput | LocalMatchActionWhereInput[]
    OR?: LocalMatchActionWhereInput[]
    NOT?: LocalMatchActionWhereInput | LocalMatchActionWhereInput[]
    id?: StringFilter<"LocalMatchAction"> | string
    matchId?: StringFilter<"LocalMatchAction"> | string
    half?: IntFilter<"LocalMatchAction"> | number
    turn?: IntFilter<"LocalMatchAction"> | number
    actionType?: StringFilter<"LocalMatchAction"> | string
    playerId?: StringFilter<"LocalMatchAction"> | string
    playerName?: StringFilter<"LocalMatchAction"> | string
    playerTeam?: StringFilter<"LocalMatchAction"> | string
    opponentId?: StringNullableFilter<"LocalMatchAction"> | string | null
    opponentName?: StringNullableFilter<"LocalMatchAction"> | string | null
    diceResult?: IntNullableFilter<"LocalMatchAction"> | number | null
    fumble?: BoolFilter<"LocalMatchAction"> | boolean
    playerState?: StringNullableFilter<"LocalMatchAction"> | string | null
    armorBroken?: BoolFilter<"LocalMatchAction"> | boolean
    opponentState?: StringNullableFilter<"LocalMatchAction"> | string | null
    passType?: StringNullableFilter<"LocalMatchAction"> | string | null
    createdAt?: DateTimeFilter<"LocalMatchAction"> | Date | string
    updatedAt?: DateTimeFilter<"LocalMatchAction"> | Date | string
    match?: XOR<LocalMatchScalarRelationFilter, LocalMatchWhereInput>
  }

  export type LocalMatchActionOrderByWithRelationInput = {
    id?: SortOrder
    matchId?: SortOrder
    half?: SortOrder
    turn?: SortOrder
    actionType?: SortOrder
    playerId?: SortOrder
    playerName?: SortOrder
    playerTeam?: SortOrder
    opponentId?: SortOrderInput | SortOrder
    opponentName?: SortOrderInput | SortOrder
    diceResult?: SortOrderInput | SortOrder
    fumble?: SortOrder
    playerState?: SortOrderInput | SortOrder
    armorBroken?: SortOrder
    opponentState?: SortOrderInput | SortOrder
    passType?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    match?: LocalMatchOrderByWithRelationInput
  }

  export type LocalMatchActionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: LocalMatchActionWhereInput | LocalMatchActionWhereInput[]
    OR?: LocalMatchActionWhereInput[]
    NOT?: LocalMatchActionWhereInput | LocalMatchActionWhereInput[]
    matchId?: StringFilter<"LocalMatchAction"> | string
    half?: IntFilter<"LocalMatchAction"> | number
    turn?: IntFilter<"LocalMatchAction"> | number
    actionType?: StringFilter<"LocalMatchAction"> | string
    playerId?: StringFilter<"LocalMatchAction"> | string
    playerName?: StringFilter<"LocalMatchAction"> | string
    playerTeam?: StringFilter<"LocalMatchAction"> | string
    opponentId?: StringNullableFilter<"LocalMatchAction"> | string | null
    opponentName?: StringNullableFilter<"LocalMatchAction"> | string | null
    diceResult?: IntNullableFilter<"LocalMatchAction"> | number | null
    fumble?: BoolFilter<"LocalMatchAction"> | boolean
    playerState?: StringNullableFilter<"LocalMatchAction"> | string | null
    armorBroken?: BoolFilter<"LocalMatchAction"> | boolean
    opponentState?: StringNullableFilter<"LocalMatchAction"> | string | null
    passType?: StringNullableFilter<"LocalMatchAction"> | string | null
    createdAt?: DateTimeFilter<"LocalMatchAction"> | Date | string
    updatedAt?: DateTimeFilter<"LocalMatchAction"> | Date | string
    match?: XOR<LocalMatchScalarRelationFilter, LocalMatchWhereInput>
  }, "id">

  export type LocalMatchActionOrderByWithAggregationInput = {
    id?: SortOrder
    matchId?: SortOrder
    half?: SortOrder
    turn?: SortOrder
    actionType?: SortOrder
    playerId?: SortOrder
    playerName?: SortOrder
    playerTeam?: SortOrder
    opponentId?: SortOrderInput | SortOrder
    opponentName?: SortOrderInput | SortOrder
    diceResult?: SortOrderInput | SortOrder
    fumble?: SortOrder
    playerState?: SortOrderInput | SortOrder
    armorBroken?: SortOrder
    opponentState?: SortOrderInput | SortOrder
    passType?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: LocalMatchActionCountOrderByAggregateInput
    _avg?: LocalMatchActionAvgOrderByAggregateInput
    _max?: LocalMatchActionMaxOrderByAggregateInput
    _min?: LocalMatchActionMinOrderByAggregateInput
    _sum?: LocalMatchActionSumOrderByAggregateInput
  }

  export type LocalMatchActionScalarWhereWithAggregatesInput = {
    AND?: LocalMatchActionScalarWhereWithAggregatesInput | LocalMatchActionScalarWhereWithAggregatesInput[]
    OR?: LocalMatchActionScalarWhereWithAggregatesInput[]
    NOT?: LocalMatchActionScalarWhereWithAggregatesInput | LocalMatchActionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"LocalMatchAction"> | string
    matchId?: StringWithAggregatesFilter<"LocalMatchAction"> | string
    half?: IntWithAggregatesFilter<"LocalMatchAction"> | number
    turn?: IntWithAggregatesFilter<"LocalMatchAction"> | number
    actionType?: StringWithAggregatesFilter<"LocalMatchAction"> | string
    playerId?: StringWithAggregatesFilter<"LocalMatchAction"> | string
    playerName?: StringWithAggregatesFilter<"LocalMatchAction"> | string
    playerTeam?: StringWithAggregatesFilter<"LocalMatchAction"> | string
    opponentId?: StringNullableWithAggregatesFilter<"LocalMatchAction"> | string | null
    opponentName?: StringNullableWithAggregatesFilter<"LocalMatchAction"> | string | null
    diceResult?: IntNullableWithAggregatesFilter<"LocalMatchAction"> | number | null
    fumble?: BoolWithAggregatesFilter<"LocalMatchAction"> | boolean
    playerState?: StringNullableWithAggregatesFilter<"LocalMatchAction"> | string | null
    armorBroken?: BoolWithAggregatesFilter<"LocalMatchAction"> | boolean
    opponentState?: StringNullableWithAggregatesFilter<"LocalMatchAction"> | string | null
    passType?: StringNullableWithAggregatesFilter<"LocalMatchAction"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"LocalMatchAction"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"LocalMatchAction"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
    createdCups?: CupCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
    createdCups?: CupUncheckedCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchUncheckedCreateNestedManyWithoutCreatorInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
    createdCups?: CupUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
    createdCups?: CupUncheckedUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
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
    team?: string | null
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTeamSelectionsInput
    user: UserCreateNestedOneWithoutTeamSelectionsInput
    teamRef?: TeamCreateNestedOneWithoutSelectionsInput
  }

  export type TeamSelectionUncheckedCreateInput = {
    id?: string
    matchId: string
    userId: string
    team?: string | null
    teamId?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput
    user?: UserUpdateOneRequiredWithoutTeamSelectionsNestedInput
    teamRef?: TeamUpdateOneWithoutSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionCreateManyInput = {
    id?: string
    matchId: string
    userId: string
    team?: string | null
    teamId?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamCreateInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchCreateNestedManyWithoutTeamBInput
  }

  export type TeamUncheckedCreateInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantUncheckedCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchUncheckedCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchUncheckedCreateNestedManyWithoutTeamBInput
  }

  export type TeamUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUncheckedUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUncheckedUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput
  }

  export type TeamCreateManyInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
  }

  export type TeamUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
  }

  export type TeamUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
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

  export type CupCreateInput = {
    id?: string
    name: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    creator: UserCreateNestedOneWithoutCreatedCupsInput
    participants?: CupParticipantCreateNestedManyWithoutCupInput
    localMatches?: LocalMatchCreateNestedManyWithoutCupInput
  }

  export type CupUncheckedCreateInput = {
    id?: string
    name: string
    creatorId: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    participants?: CupParticipantUncheckedCreateNestedManyWithoutCupInput
    localMatches?: LocalMatchUncheckedCreateNestedManyWithoutCupInput
  }

  export type CupUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    creator?: UserUpdateOneRequiredWithoutCreatedCupsNestedInput
    participants?: CupParticipantUpdateManyWithoutCupNestedInput
    localMatches?: LocalMatchUpdateManyWithoutCupNestedInput
  }

  export type CupUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    creatorId?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    participants?: CupParticipantUncheckedUpdateManyWithoutCupNestedInput
    localMatches?: LocalMatchUncheckedUpdateManyWithoutCupNestedInput
  }

  export type CupCreateManyInput = {
    id?: string
    name: string
    creatorId: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CupUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    creatorId?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupParticipantCreateInput = {
    id?: string
    createdAt?: Date | string
    cup: CupCreateNestedOneWithoutParticipantsInput
    team: TeamCreateNestedOneWithoutCupParticipantsInput
  }

  export type CupParticipantUncheckedCreateInput = {
    id?: string
    cupId: string
    teamId: string
    createdAt?: Date | string
  }

  export type CupParticipantUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cup?: CupUpdateOneRequiredWithoutParticipantsNestedInput
    team?: TeamUpdateOneRequiredWithoutCupParticipantsNestedInput
  }

  export type CupParticipantUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    cupId?: StringFieldUpdateOperationsInput | string
    teamId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupParticipantCreateManyInput = {
    id?: string
    cupId: string
    teamId: string
    createdAt?: Date | string
  }

  export type CupParticipantUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupParticipantUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    cupId?: StringFieldUpdateOperationsInput | string
    teamId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchCreateInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    creator: UserCreateNestedOneWithoutCreatedLocalMatchesInput
    teamA: TeamCreateNestedOneWithoutLocalMatchesAsTeamAInput
    teamB?: TeamCreateNestedOneWithoutLocalMatchesAsTeamBInput
    cup?: CupCreateNestedOneWithoutLocalMatchesInput
    actions?: LocalMatchActionCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchUncheckedCreateInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    actions?: LocalMatchActionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    creator?: UserUpdateOneRequiredWithoutCreatedLocalMatchesNestedInput
    teamA?: TeamUpdateOneRequiredWithoutLocalMatchesAsTeamANestedInput
    teamB?: TeamUpdateOneWithoutLocalMatchesAsTeamBNestedInput
    cup?: CupUpdateOneWithoutLocalMatchesNestedInput
    actions?: LocalMatchActionUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    actions?: LocalMatchActionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchCreateManyInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
  }

  export type LocalMatchUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type LocalMatchUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type LocalMatchActionCreateInput = {
    id?: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId?: string | null
    opponentName?: string | null
    diceResult?: number | null
    fumble?: boolean
    playerState?: string | null
    armorBroken?: boolean
    opponentState?: string | null
    passType?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    match: LocalMatchCreateNestedOneWithoutActionsInput
  }

  export type LocalMatchActionUncheckedCreateInput = {
    id?: string
    matchId: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId?: string | null
    opponentName?: string | null
    diceResult?: number | null
    fumble?: boolean
    playerState?: string | null
    armorBroken?: boolean
    opponentState?: string | null
    passType?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocalMatchActionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: LocalMatchUpdateOneRequiredWithoutActionsNestedInput
  }

  export type LocalMatchActionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchActionCreateManyInput = {
    id?: string
    matchId: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId?: string | null
    opponentName?: string | null
    diceResult?: number | null
    fumble?: boolean
    playerState?: string | null
    armorBroken?: boolean
    opponentState?: string | null
    passType?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocalMatchActionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchActionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
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

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
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

  export type CupListRelationFilter = {
    every?: CupWhereInput
    some?: CupWhereInput
    none?: CupWhereInput
  }

  export type LocalMatchListRelationFilter = {
    every?: LocalMatchWhereInput
    some?: LocalMatchWhereInput
    none?: LocalMatchWhereInput
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

  export type CupOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type LocalMatchOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    coachName?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    dateOfBirth?: SortOrder
    role?: SortOrder
    roles?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    coachName?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    dateOfBirth?: SortOrder
    role?: SortOrder
    roles?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    coachName?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    dateOfBirth?: SortOrder
    role?: SortOrder
    roles?: SortOrder
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

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
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

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type TeamPlayerListRelationFilter = {
    every?: TeamPlayerWhereInput
    some?: TeamPlayerWhereInput
    none?: TeamPlayerWhereInput
  }

  export type CupParticipantListRelationFilter = {
    every?: CupParticipantWhereInput
    some?: CupParticipantWhereInput
    none?: CupParticipantWhereInput
  }

  export type TeamPlayerOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CupParticipantOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TeamCountOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    apothecary?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
  }

  export type TeamAvgOrderByAggregateInput = {
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
  }

  export type TeamMaxOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    apothecary?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
  }

  export type TeamMinOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    name?: SortOrder
    roster?: SortOrder
    createdAt?: SortOrder
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    apothecary?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
  }

  export type TeamSumOrderByAggregateInput = {
    treasury?: SortOrder
    rerolls?: SortOrder
    cheerleaders?: SortOrder
    assistants?: SortOrder
    dedicatedFans?: SortOrder
    teamValue?: SortOrder
    currentValue?: SortOrder
    initialBudget?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
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

  export type CupCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    creatorId?: SortOrder
    validated?: SortOrder
    isPublic?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CupMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    creatorId?: SortOrder
    validated?: SortOrder
    isPublic?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CupMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    creatorId?: SortOrder
    validated?: SortOrder
    isPublic?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CupScalarRelationFilter = {
    is?: CupWhereInput
    isNot?: CupWhereInput
  }

  export type CupParticipantCupIdTeamIdCompoundUniqueInput = {
    cupId: string
    teamId: string
  }

  export type CupParticipantCountOrderByAggregateInput = {
    id?: SortOrder
    cupId?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
  }

  export type CupParticipantMaxOrderByAggregateInput = {
    id?: SortOrder
    cupId?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
  }

  export type CupParticipantMinOrderByAggregateInput = {
    id?: SortOrder
    cupId?: SortOrder
    teamId?: SortOrder
    createdAt?: SortOrder
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
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

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type CupNullableScalarRelationFilter = {
    is?: CupWhereInput | null
    isNot?: CupWhereInput | null
  }

  export type LocalMatchActionListRelationFilter = {
    every?: LocalMatchActionWhereInput
    some?: LocalMatchActionWhereInput
    none?: LocalMatchActionWhereInput
  }

  export type LocalMatchActionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type LocalMatchCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    creatorId?: SortOrder
    teamAId?: SortOrder
    teamBId?: SortOrder
    cupId?: SortOrder
    shareToken?: SortOrder
    teamAOwnerValidated?: SortOrder
    teamBOwnerValidated?: SortOrder
    gameState?: SortOrder
    scoreTeamA?: SortOrder
    scoreTeamB?: SortOrder
  }

  export type LocalMatchAvgOrderByAggregateInput = {
    scoreTeamA?: SortOrder
    scoreTeamB?: SortOrder
  }

  export type LocalMatchMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    creatorId?: SortOrder
    teamAId?: SortOrder
    teamBId?: SortOrder
    cupId?: SortOrder
    shareToken?: SortOrder
    teamAOwnerValidated?: SortOrder
    teamBOwnerValidated?: SortOrder
    scoreTeamA?: SortOrder
    scoreTeamB?: SortOrder
  }

  export type LocalMatchMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    creatorId?: SortOrder
    teamAId?: SortOrder
    teamBId?: SortOrder
    cupId?: SortOrder
    shareToken?: SortOrder
    teamAOwnerValidated?: SortOrder
    teamBOwnerValidated?: SortOrder
    scoreTeamA?: SortOrder
    scoreTeamB?: SortOrder
  }

  export type LocalMatchSumOrderByAggregateInput = {
    scoreTeamA?: SortOrder
    scoreTeamB?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type LocalMatchScalarRelationFilter = {
    is?: LocalMatchWhereInput
    isNot?: LocalMatchWhereInput
  }

  export type LocalMatchActionCountOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    half?: SortOrder
    turn?: SortOrder
    actionType?: SortOrder
    playerId?: SortOrder
    playerName?: SortOrder
    playerTeam?: SortOrder
    opponentId?: SortOrder
    opponentName?: SortOrder
    diceResult?: SortOrder
    fumble?: SortOrder
    playerState?: SortOrder
    armorBroken?: SortOrder
    opponentState?: SortOrder
    passType?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocalMatchActionAvgOrderByAggregateInput = {
    half?: SortOrder
    turn?: SortOrder
    diceResult?: SortOrder
  }

  export type LocalMatchActionMaxOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    half?: SortOrder
    turn?: SortOrder
    actionType?: SortOrder
    playerId?: SortOrder
    playerName?: SortOrder
    playerTeam?: SortOrder
    opponentId?: SortOrder
    opponentName?: SortOrder
    diceResult?: SortOrder
    fumble?: SortOrder
    playerState?: SortOrder
    armorBroken?: SortOrder
    opponentState?: SortOrder
    passType?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocalMatchActionMinOrderByAggregateInput = {
    id?: SortOrder
    matchId?: SortOrder
    half?: SortOrder
    turn?: SortOrder
    actionType?: SortOrder
    playerId?: SortOrder
    playerName?: SortOrder
    playerTeam?: SortOrder
    opponentId?: SortOrder
    opponentName?: SortOrder
    diceResult?: SortOrder
    fumble?: SortOrder
    playerState?: SortOrder
    armorBroken?: SortOrder
    opponentState?: SortOrder
    passType?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocalMatchActionSumOrderByAggregateInput = {
    half?: SortOrder
    turn?: SortOrder
    diceResult?: SortOrder
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

  export type CupCreateNestedManyWithoutCreatorInput = {
    create?: XOR<CupCreateWithoutCreatorInput, CupUncheckedCreateWithoutCreatorInput> | CupCreateWithoutCreatorInput[] | CupUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: CupCreateOrConnectWithoutCreatorInput | CupCreateOrConnectWithoutCreatorInput[]
    createMany?: CupCreateManyCreatorInputEnvelope
    connect?: CupWhereUniqueInput | CupWhereUniqueInput[]
  }

  export type LocalMatchCreateNestedManyWithoutCreatorInput = {
    create?: XOR<LocalMatchCreateWithoutCreatorInput, LocalMatchUncheckedCreateWithoutCreatorInput> | LocalMatchCreateWithoutCreatorInput[] | LocalMatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCreatorInput | LocalMatchCreateOrConnectWithoutCreatorInput[]
    createMany?: LocalMatchCreateManyCreatorInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
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

  export type CupUncheckedCreateNestedManyWithoutCreatorInput = {
    create?: XOR<CupCreateWithoutCreatorInput, CupUncheckedCreateWithoutCreatorInput> | CupCreateWithoutCreatorInput[] | CupUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: CupCreateOrConnectWithoutCreatorInput | CupCreateOrConnectWithoutCreatorInput[]
    createMany?: CupCreateManyCreatorInputEnvelope
    connect?: CupWhereUniqueInput | CupWhereUniqueInput[]
  }

  export type LocalMatchUncheckedCreateNestedManyWithoutCreatorInput = {
    create?: XOR<LocalMatchCreateWithoutCreatorInput, LocalMatchUncheckedCreateWithoutCreatorInput> | LocalMatchCreateWithoutCreatorInput[] | LocalMatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCreatorInput | LocalMatchCreateOrConnectWithoutCreatorInput[]
    createMany?: LocalMatchCreateManyCreatorInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
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

  export type CupUpdateManyWithoutCreatorNestedInput = {
    create?: XOR<CupCreateWithoutCreatorInput, CupUncheckedCreateWithoutCreatorInput> | CupCreateWithoutCreatorInput[] | CupUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: CupCreateOrConnectWithoutCreatorInput | CupCreateOrConnectWithoutCreatorInput[]
    upsert?: CupUpsertWithWhereUniqueWithoutCreatorInput | CupUpsertWithWhereUniqueWithoutCreatorInput[]
    createMany?: CupCreateManyCreatorInputEnvelope
    set?: CupWhereUniqueInput | CupWhereUniqueInput[]
    disconnect?: CupWhereUniqueInput | CupWhereUniqueInput[]
    delete?: CupWhereUniqueInput | CupWhereUniqueInput[]
    connect?: CupWhereUniqueInput | CupWhereUniqueInput[]
    update?: CupUpdateWithWhereUniqueWithoutCreatorInput | CupUpdateWithWhereUniqueWithoutCreatorInput[]
    updateMany?: CupUpdateManyWithWhereWithoutCreatorInput | CupUpdateManyWithWhereWithoutCreatorInput[]
    deleteMany?: CupScalarWhereInput | CupScalarWhereInput[]
  }

  export type LocalMatchUpdateManyWithoutCreatorNestedInput = {
    create?: XOR<LocalMatchCreateWithoutCreatorInput, LocalMatchUncheckedCreateWithoutCreatorInput> | LocalMatchCreateWithoutCreatorInput[] | LocalMatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCreatorInput | LocalMatchCreateOrConnectWithoutCreatorInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutCreatorInput | LocalMatchUpsertWithWhereUniqueWithoutCreatorInput[]
    createMany?: LocalMatchCreateManyCreatorInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutCreatorInput | LocalMatchUpdateWithWhereUniqueWithoutCreatorInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutCreatorInput | LocalMatchUpdateManyWithWhereWithoutCreatorInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
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

  export type CupUncheckedUpdateManyWithoutCreatorNestedInput = {
    create?: XOR<CupCreateWithoutCreatorInput, CupUncheckedCreateWithoutCreatorInput> | CupCreateWithoutCreatorInput[] | CupUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: CupCreateOrConnectWithoutCreatorInput | CupCreateOrConnectWithoutCreatorInput[]
    upsert?: CupUpsertWithWhereUniqueWithoutCreatorInput | CupUpsertWithWhereUniqueWithoutCreatorInput[]
    createMany?: CupCreateManyCreatorInputEnvelope
    set?: CupWhereUniqueInput | CupWhereUniqueInput[]
    disconnect?: CupWhereUniqueInput | CupWhereUniqueInput[]
    delete?: CupWhereUniqueInput | CupWhereUniqueInput[]
    connect?: CupWhereUniqueInput | CupWhereUniqueInput[]
    update?: CupUpdateWithWhereUniqueWithoutCreatorInput | CupUpdateWithWhereUniqueWithoutCreatorInput[]
    updateMany?: CupUpdateManyWithWhereWithoutCreatorInput | CupUpdateManyWithWhereWithoutCreatorInput[]
    deleteMany?: CupScalarWhereInput | CupScalarWhereInput[]
  }

  export type LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput = {
    create?: XOR<LocalMatchCreateWithoutCreatorInput, LocalMatchUncheckedCreateWithoutCreatorInput> | LocalMatchCreateWithoutCreatorInput[] | LocalMatchUncheckedCreateWithoutCreatorInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCreatorInput | LocalMatchCreateOrConnectWithoutCreatorInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutCreatorInput | LocalMatchUpsertWithWhereUniqueWithoutCreatorInput[]
    createMany?: LocalMatchCreateManyCreatorInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutCreatorInput | LocalMatchUpdateWithWhereUniqueWithoutCreatorInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutCreatorInput | LocalMatchUpdateManyWithWhereWithoutCreatorInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
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

  export type CupParticipantCreateNestedManyWithoutTeamInput = {
    create?: XOR<CupParticipantCreateWithoutTeamInput, CupParticipantUncheckedCreateWithoutTeamInput> | CupParticipantCreateWithoutTeamInput[] | CupParticipantUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutTeamInput | CupParticipantCreateOrConnectWithoutTeamInput[]
    createMany?: CupParticipantCreateManyTeamInputEnvelope
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
  }

  export type LocalMatchCreateNestedManyWithoutTeamAInput = {
    create?: XOR<LocalMatchCreateWithoutTeamAInput, LocalMatchUncheckedCreateWithoutTeamAInput> | LocalMatchCreateWithoutTeamAInput[] | LocalMatchUncheckedCreateWithoutTeamAInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamAInput | LocalMatchCreateOrConnectWithoutTeamAInput[]
    createMany?: LocalMatchCreateManyTeamAInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
  }

  export type LocalMatchCreateNestedManyWithoutTeamBInput = {
    create?: XOR<LocalMatchCreateWithoutTeamBInput, LocalMatchUncheckedCreateWithoutTeamBInput> | LocalMatchCreateWithoutTeamBInput[] | LocalMatchUncheckedCreateWithoutTeamBInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamBInput | LocalMatchCreateOrConnectWithoutTeamBInput[]
    createMany?: LocalMatchCreateManyTeamBInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
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

  export type CupParticipantUncheckedCreateNestedManyWithoutTeamInput = {
    create?: XOR<CupParticipantCreateWithoutTeamInput, CupParticipantUncheckedCreateWithoutTeamInput> | CupParticipantCreateWithoutTeamInput[] | CupParticipantUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutTeamInput | CupParticipantCreateOrConnectWithoutTeamInput[]
    createMany?: CupParticipantCreateManyTeamInputEnvelope
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
  }

  export type LocalMatchUncheckedCreateNestedManyWithoutTeamAInput = {
    create?: XOR<LocalMatchCreateWithoutTeamAInput, LocalMatchUncheckedCreateWithoutTeamAInput> | LocalMatchCreateWithoutTeamAInput[] | LocalMatchUncheckedCreateWithoutTeamAInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamAInput | LocalMatchCreateOrConnectWithoutTeamAInput[]
    createMany?: LocalMatchCreateManyTeamAInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
  }

  export type LocalMatchUncheckedCreateNestedManyWithoutTeamBInput = {
    create?: XOR<LocalMatchCreateWithoutTeamBInput, LocalMatchUncheckedCreateWithoutTeamBInput> | LocalMatchCreateWithoutTeamBInput[] | LocalMatchUncheckedCreateWithoutTeamBInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamBInput | LocalMatchCreateOrConnectWithoutTeamBInput[]
    createMany?: LocalMatchCreateManyTeamBInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
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

  export type CupParticipantUpdateManyWithoutTeamNestedInput = {
    create?: XOR<CupParticipantCreateWithoutTeamInput, CupParticipantUncheckedCreateWithoutTeamInput> | CupParticipantCreateWithoutTeamInput[] | CupParticipantUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutTeamInput | CupParticipantCreateOrConnectWithoutTeamInput[]
    upsert?: CupParticipantUpsertWithWhereUniqueWithoutTeamInput | CupParticipantUpsertWithWhereUniqueWithoutTeamInput[]
    createMany?: CupParticipantCreateManyTeamInputEnvelope
    set?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    disconnect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    delete?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    update?: CupParticipantUpdateWithWhereUniqueWithoutTeamInput | CupParticipantUpdateWithWhereUniqueWithoutTeamInput[]
    updateMany?: CupParticipantUpdateManyWithWhereWithoutTeamInput | CupParticipantUpdateManyWithWhereWithoutTeamInput[]
    deleteMany?: CupParticipantScalarWhereInput | CupParticipantScalarWhereInput[]
  }

  export type LocalMatchUpdateManyWithoutTeamANestedInput = {
    create?: XOR<LocalMatchCreateWithoutTeamAInput, LocalMatchUncheckedCreateWithoutTeamAInput> | LocalMatchCreateWithoutTeamAInput[] | LocalMatchUncheckedCreateWithoutTeamAInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamAInput | LocalMatchCreateOrConnectWithoutTeamAInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutTeamAInput | LocalMatchUpsertWithWhereUniqueWithoutTeamAInput[]
    createMany?: LocalMatchCreateManyTeamAInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutTeamAInput | LocalMatchUpdateWithWhereUniqueWithoutTeamAInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutTeamAInput | LocalMatchUpdateManyWithWhereWithoutTeamAInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
  }

  export type LocalMatchUpdateManyWithoutTeamBNestedInput = {
    create?: XOR<LocalMatchCreateWithoutTeamBInput, LocalMatchUncheckedCreateWithoutTeamBInput> | LocalMatchCreateWithoutTeamBInput[] | LocalMatchUncheckedCreateWithoutTeamBInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamBInput | LocalMatchCreateOrConnectWithoutTeamBInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutTeamBInput | LocalMatchUpsertWithWhereUniqueWithoutTeamBInput[]
    createMany?: LocalMatchCreateManyTeamBInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutTeamBInput | LocalMatchUpdateWithWhereUniqueWithoutTeamBInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutTeamBInput | LocalMatchUpdateManyWithWhereWithoutTeamBInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
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

  export type CupParticipantUncheckedUpdateManyWithoutTeamNestedInput = {
    create?: XOR<CupParticipantCreateWithoutTeamInput, CupParticipantUncheckedCreateWithoutTeamInput> | CupParticipantCreateWithoutTeamInput[] | CupParticipantUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutTeamInput | CupParticipantCreateOrConnectWithoutTeamInput[]
    upsert?: CupParticipantUpsertWithWhereUniqueWithoutTeamInput | CupParticipantUpsertWithWhereUniqueWithoutTeamInput[]
    createMany?: CupParticipantCreateManyTeamInputEnvelope
    set?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    disconnect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    delete?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    update?: CupParticipantUpdateWithWhereUniqueWithoutTeamInput | CupParticipantUpdateWithWhereUniqueWithoutTeamInput[]
    updateMany?: CupParticipantUpdateManyWithWhereWithoutTeamInput | CupParticipantUpdateManyWithWhereWithoutTeamInput[]
    deleteMany?: CupParticipantScalarWhereInput | CupParticipantScalarWhereInput[]
  }

  export type LocalMatchUncheckedUpdateManyWithoutTeamANestedInput = {
    create?: XOR<LocalMatchCreateWithoutTeamAInput, LocalMatchUncheckedCreateWithoutTeamAInput> | LocalMatchCreateWithoutTeamAInput[] | LocalMatchUncheckedCreateWithoutTeamAInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamAInput | LocalMatchCreateOrConnectWithoutTeamAInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutTeamAInput | LocalMatchUpsertWithWhereUniqueWithoutTeamAInput[]
    createMany?: LocalMatchCreateManyTeamAInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutTeamAInput | LocalMatchUpdateWithWhereUniqueWithoutTeamAInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutTeamAInput | LocalMatchUpdateManyWithWhereWithoutTeamAInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
  }

  export type LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput = {
    create?: XOR<LocalMatchCreateWithoutTeamBInput, LocalMatchUncheckedCreateWithoutTeamBInput> | LocalMatchCreateWithoutTeamBInput[] | LocalMatchUncheckedCreateWithoutTeamBInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutTeamBInput | LocalMatchCreateOrConnectWithoutTeamBInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutTeamBInput | LocalMatchUpsertWithWhereUniqueWithoutTeamBInput[]
    createMany?: LocalMatchCreateManyTeamBInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutTeamBInput | LocalMatchUpdateWithWhereUniqueWithoutTeamBInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutTeamBInput | LocalMatchUpdateManyWithWhereWithoutTeamBInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
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

  export type UserCreateNestedOneWithoutCreatedCupsInput = {
    create?: XOR<UserCreateWithoutCreatedCupsInput, UserUncheckedCreateWithoutCreatedCupsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedCupsInput
    connect?: UserWhereUniqueInput
  }

  export type CupParticipantCreateNestedManyWithoutCupInput = {
    create?: XOR<CupParticipantCreateWithoutCupInput, CupParticipantUncheckedCreateWithoutCupInput> | CupParticipantCreateWithoutCupInput[] | CupParticipantUncheckedCreateWithoutCupInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutCupInput | CupParticipantCreateOrConnectWithoutCupInput[]
    createMany?: CupParticipantCreateManyCupInputEnvelope
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
  }

  export type LocalMatchCreateNestedManyWithoutCupInput = {
    create?: XOR<LocalMatchCreateWithoutCupInput, LocalMatchUncheckedCreateWithoutCupInput> | LocalMatchCreateWithoutCupInput[] | LocalMatchUncheckedCreateWithoutCupInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCupInput | LocalMatchCreateOrConnectWithoutCupInput[]
    createMany?: LocalMatchCreateManyCupInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
  }

  export type CupParticipantUncheckedCreateNestedManyWithoutCupInput = {
    create?: XOR<CupParticipantCreateWithoutCupInput, CupParticipantUncheckedCreateWithoutCupInput> | CupParticipantCreateWithoutCupInput[] | CupParticipantUncheckedCreateWithoutCupInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutCupInput | CupParticipantCreateOrConnectWithoutCupInput[]
    createMany?: CupParticipantCreateManyCupInputEnvelope
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
  }

  export type LocalMatchUncheckedCreateNestedManyWithoutCupInput = {
    create?: XOR<LocalMatchCreateWithoutCupInput, LocalMatchUncheckedCreateWithoutCupInput> | LocalMatchCreateWithoutCupInput[] | LocalMatchUncheckedCreateWithoutCupInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCupInput | LocalMatchCreateOrConnectWithoutCupInput[]
    createMany?: LocalMatchCreateManyCupInputEnvelope
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutCreatedCupsNestedInput = {
    create?: XOR<UserCreateWithoutCreatedCupsInput, UserUncheckedCreateWithoutCreatedCupsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedCupsInput
    upsert?: UserUpsertWithoutCreatedCupsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCreatedCupsInput, UserUpdateWithoutCreatedCupsInput>, UserUncheckedUpdateWithoutCreatedCupsInput>
  }

  export type CupParticipantUpdateManyWithoutCupNestedInput = {
    create?: XOR<CupParticipantCreateWithoutCupInput, CupParticipantUncheckedCreateWithoutCupInput> | CupParticipantCreateWithoutCupInput[] | CupParticipantUncheckedCreateWithoutCupInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutCupInput | CupParticipantCreateOrConnectWithoutCupInput[]
    upsert?: CupParticipantUpsertWithWhereUniqueWithoutCupInput | CupParticipantUpsertWithWhereUniqueWithoutCupInput[]
    createMany?: CupParticipantCreateManyCupInputEnvelope
    set?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    disconnect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    delete?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    update?: CupParticipantUpdateWithWhereUniqueWithoutCupInput | CupParticipantUpdateWithWhereUniqueWithoutCupInput[]
    updateMany?: CupParticipantUpdateManyWithWhereWithoutCupInput | CupParticipantUpdateManyWithWhereWithoutCupInput[]
    deleteMany?: CupParticipantScalarWhereInput | CupParticipantScalarWhereInput[]
  }

  export type LocalMatchUpdateManyWithoutCupNestedInput = {
    create?: XOR<LocalMatchCreateWithoutCupInput, LocalMatchUncheckedCreateWithoutCupInput> | LocalMatchCreateWithoutCupInput[] | LocalMatchUncheckedCreateWithoutCupInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCupInput | LocalMatchCreateOrConnectWithoutCupInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutCupInput | LocalMatchUpsertWithWhereUniqueWithoutCupInput[]
    createMany?: LocalMatchCreateManyCupInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutCupInput | LocalMatchUpdateWithWhereUniqueWithoutCupInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutCupInput | LocalMatchUpdateManyWithWhereWithoutCupInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
  }

  export type CupParticipantUncheckedUpdateManyWithoutCupNestedInput = {
    create?: XOR<CupParticipantCreateWithoutCupInput, CupParticipantUncheckedCreateWithoutCupInput> | CupParticipantCreateWithoutCupInput[] | CupParticipantUncheckedCreateWithoutCupInput[]
    connectOrCreate?: CupParticipantCreateOrConnectWithoutCupInput | CupParticipantCreateOrConnectWithoutCupInput[]
    upsert?: CupParticipantUpsertWithWhereUniqueWithoutCupInput | CupParticipantUpsertWithWhereUniqueWithoutCupInput[]
    createMany?: CupParticipantCreateManyCupInputEnvelope
    set?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    disconnect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    delete?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    connect?: CupParticipantWhereUniqueInput | CupParticipantWhereUniqueInput[]
    update?: CupParticipantUpdateWithWhereUniqueWithoutCupInput | CupParticipantUpdateWithWhereUniqueWithoutCupInput[]
    updateMany?: CupParticipantUpdateManyWithWhereWithoutCupInput | CupParticipantUpdateManyWithWhereWithoutCupInput[]
    deleteMany?: CupParticipantScalarWhereInput | CupParticipantScalarWhereInput[]
  }

  export type LocalMatchUncheckedUpdateManyWithoutCupNestedInput = {
    create?: XOR<LocalMatchCreateWithoutCupInput, LocalMatchUncheckedCreateWithoutCupInput> | LocalMatchCreateWithoutCupInput[] | LocalMatchUncheckedCreateWithoutCupInput[]
    connectOrCreate?: LocalMatchCreateOrConnectWithoutCupInput | LocalMatchCreateOrConnectWithoutCupInput[]
    upsert?: LocalMatchUpsertWithWhereUniqueWithoutCupInput | LocalMatchUpsertWithWhereUniqueWithoutCupInput[]
    createMany?: LocalMatchCreateManyCupInputEnvelope
    set?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    disconnect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    delete?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    connect?: LocalMatchWhereUniqueInput | LocalMatchWhereUniqueInput[]
    update?: LocalMatchUpdateWithWhereUniqueWithoutCupInput | LocalMatchUpdateWithWhereUniqueWithoutCupInput[]
    updateMany?: LocalMatchUpdateManyWithWhereWithoutCupInput | LocalMatchUpdateManyWithWhereWithoutCupInput[]
    deleteMany?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
  }

  export type CupCreateNestedOneWithoutParticipantsInput = {
    create?: XOR<CupCreateWithoutParticipantsInput, CupUncheckedCreateWithoutParticipantsInput>
    connectOrCreate?: CupCreateOrConnectWithoutParticipantsInput
    connect?: CupWhereUniqueInput
  }

  export type TeamCreateNestedOneWithoutCupParticipantsInput = {
    create?: XOR<TeamCreateWithoutCupParticipantsInput, TeamUncheckedCreateWithoutCupParticipantsInput>
    connectOrCreate?: TeamCreateOrConnectWithoutCupParticipantsInput
    connect?: TeamWhereUniqueInput
  }

  export type CupUpdateOneRequiredWithoutParticipantsNestedInput = {
    create?: XOR<CupCreateWithoutParticipantsInput, CupUncheckedCreateWithoutParticipantsInput>
    connectOrCreate?: CupCreateOrConnectWithoutParticipantsInput
    upsert?: CupUpsertWithoutParticipantsInput
    connect?: CupWhereUniqueInput
    update?: XOR<XOR<CupUpdateToOneWithWhereWithoutParticipantsInput, CupUpdateWithoutParticipantsInput>, CupUncheckedUpdateWithoutParticipantsInput>
  }

  export type TeamUpdateOneRequiredWithoutCupParticipantsNestedInput = {
    create?: XOR<TeamCreateWithoutCupParticipantsInput, TeamUncheckedCreateWithoutCupParticipantsInput>
    connectOrCreate?: TeamCreateOrConnectWithoutCupParticipantsInput
    upsert?: TeamUpsertWithoutCupParticipantsInput
    connect?: TeamWhereUniqueInput
    update?: XOR<XOR<TeamUpdateToOneWithWhereWithoutCupParticipantsInput, TeamUpdateWithoutCupParticipantsInput>, TeamUncheckedUpdateWithoutCupParticipantsInput>
  }

  export type UserCreateNestedOneWithoutCreatedLocalMatchesInput = {
    create?: XOR<UserCreateWithoutCreatedLocalMatchesInput, UserUncheckedCreateWithoutCreatedLocalMatchesInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedLocalMatchesInput
    connect?: UserWhereUniqueInput
  }

  export type TeamCreateNestedOneWithoutLocalMatchesAsTeamAInput = {
    create?: XOR<TeamCreateWithoutLocalMatchesAsTeamAInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamAInput>
    connectOrCreate?: TeamCreateOrConnectWithoutLocalMatchesAsTeamAInput
    connect?: TeamWhereUniqueInput
  }

  export type TeamCreateNestedOneWithoutLocalMatchesAsTeamBInput = {
    create?: XOR<TeamCreateWithoutLocalMatchesAsTeamBInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamBInput>
    connectOrCreate?: TeamCreateOrConnectWithoutLocalMatchesAsTeamBInput
    connect?: TeamWhereUniqueInput
  }

  export type CupCreateNestedOneWithoutLocalMatchesInput = {
    create?: XOR<CupCreateWithoutLocalMatchesInput, CupUncheckedCreateWithoutLocalMatchesInput>
    connectOrCreate?: CupCreateOrConnectWithoutLocalMatchesInput
    connect?: CupWhereUniqueInput
  }

  export type LocalMatchActionCreateNestedManyWithoutMatchInput = {
    create?: XOR<LocalMatchActionCreateWithoutMatchInput, LocalMatchActionUncheckedCreateWithoutMatchInput> | LocalMatchActionCreateWithoutMatchInput[] | LocalMatchActionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: LocalMatchActionCreateOrConnectWithoutMatchInput | LocalMatchActionCreateOrConnectWithoutMatchInput[]
    createMany?: LocalMatchActionCreateManyMatchInputEnvelope
    connect?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
  }

  export type LocalMatchActionUncheckedCreateNestedManyWithoutMatchInput = {
    create?: XOR<LocalMatchActionCreateWithoutMatchInput, LocalMatchActionUncheckedCreateWithoutMatchInput> | LocalMatchActionCreateWithoutMatchInput[] | LocalMatchActionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: LocalMatchActionCreateOrConnectWithoutMatchInput | LocalMatchActionCreateOrConnectWithoutMatchInput[]
    createMany?: LocalMatchActionCreateManyMatchInputEnvelope
    connect?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutCreatedLocalMatchesNestedInput = {
    create?: XOR<UserCreateWithoutCreatedLocalMatchesInput, UserUncheckedCreateWithoutCreatedLocalMatchesInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedLocalMatchesInput
    upsert?: UserUpsertWithoutCreatedLocalMatchesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCreatedLocalMatchesInput, UserUpdateWithoutCreatedLocalMatchesInput>, UserUncheckedUpdateWithoutCreatedLocalMatchesInput>
  }

  export type TeamUpdateOneRequiredWithoutLocalMatchesAsTeamANestedInput = {
    create?: XOR<TeamCreateWithoutLocalMatchesAsTeamAInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamAInput>
    connectOrCreate?: TeamCreateOrConnectWithoutLocalMatchesAsTeamAInput
    upsert?: TeamUpsertWithoutLocalMatchesAsTeamAInput
    connect?: TeamWhereUniqueInput
    update?: XOR<XOR<TeamUpdateToOneWithWhereWithoutLocalMatchesAsTeamAInput, TeamUpdateWithoutLocalMatchesAsTeamAInput>, TeamUncheckedUpdateWithoutLocalMatchesAsTeamAInput>
  }

  export type TeamUpdateOneWithoutLocalMatchesAsTeamBNestedInput = {
    create?: XOR<TeamCreateWithoutLocalMatchesAsTeamBInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamBInput>
    connectOrCreate?: TeamCreateOrConnectWithoutLocalMatchesAsTeamBInput
    upsert?: TeamUpsertWithoutLocalMatchesAsTeamBInput
    disconnect?: TeamWhereInput | boolean
    delete?: TeamWhereInput | boolean
    connect?: TeamWhereUniqueInput
    update?: XOR<XOR<TeamUpdateToOneWithWhereWithoutLocalMatchesAsTeamBInput, TeamUpdateWithoutLocalMatchesAsTeamBInput>, TeamUncheckedUpdateWithoutLocalMatchesAsTeamBInput>
  }

  export type CupUpdateOneWithoutLocalMatchesNestedInput = {
    create?: XOR<CupCreateWithoutLocalMatchesInput, CupUncheckedCreateWithoutLocalMatchesInput>
    connectOrCreate?: CupCreateOrConnectWithoutLocalMatchesInput
    upsert?: CupUpsertWithoutLocalMatchesInput
    disconnect?: CupWhereInput | boolean
    delete?: CupWhereInput | boolean
    connect?: CupWhereUniqueInput
    update?: XOR<XOR<CupUpdateToOneWithWhereWithoutLocalMatchesInput, CupUpdateWithoutLocalMatchesInput>, CupUncheckedUpdateWithoutLocalMatchesInput>
  }

  export type LocalMatchActionUpdateManyWithoutMatchNestedInput = {
    create?: XOR<LocalMatchActionCreateWithoutMatchInput, LocalMatchActionUncheckedCreateWithoutMatchInput> | LocalMatchActionCreateWithoutMatchInput[] | LocalMatchActionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: LocalMatchActionCreateOrConnectWithoutMatchInput | LocalMatchActionCreateOrConnectWithoutMatchInput[]
    upsert?: LocalMatchActionUpsertWithWhereUniqueWithoutMatchInput | LocalMatchActionUpsertWithWhereUniqueWithoutMatchInput[]
    createMany?: LocalMatchActionCreateManyMatchInputEnvelope
    set?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    disconnect?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    delete?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    connect?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    update?: LocalMatchActionUpdateWithWhereUniqueWithoutMatchInput | LocalMatchActionUpdateWithWhereUniqueWithoutMatchInput[]
    updateMany?: LocalMatchActionUpdateManyWithWhereWithoutMatchInput | LocalMatchActionUpdateManyWithWhereWithoutMatchInput[]
    deleteMany?: LocalMatchActionScalarWhereInput | LocalMatchActionScalarWhereInput[]
  }

  export type LocalMatchActionUncheckedUpdateManyWithoutMatchNestedInput = {
    create?: XOR<LocalMatchActionCreateWithoutMatchInput, LocalMatchActionUncheckedCreateWithoutMatchInput> | LocalMatchActionCreateWithoutMatchInput[] | LocalMatchActionUncheckedCreateWithoutMatchInput[]
    connectOrCreate?: LocalMatchActionCreateOrConnectWithoutMatchInput | LocalMatchActionCreateOrConnectWithoutMatchInput[]
    upsert?: LocalMatchActionUpsertWithWhereUniqueWithoutMatchInput | LocalMatchActionUpsertWithWhereUniqueWithoutMatchInput[]
    createMany?: LocalMatchActionCreateManyMatchInputEnvelope
    set?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    disconnect?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    delete?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    connect?: LocalMatchActionWhereUniqueInput | LocalMatchActionWhereUniqueInput[]
    update?: LocalMatchActionUpdateWithWhereUniqueWithoutMatchInput | LocalMatchActionUpdateWithWhereUniqueWithoutMatchInput[]
    updateMany?: LocalMatchActionUpdateManyWithWhereWithoutMatchInput | LocalMatchActionUpdateManyWithWhereWithoutMatchInput[]
    deleteMany?: LocalMatchActionScalarWhereInput | LocalMatchActionScalarWhereInput[]
  }

  export type LocalMatchCreateNestedOneWithoutActionsInput = {
    create?: XOR<LocalMatchCreateWithoutActionsInput, LocalMatchUncheckedCreateWithoutActionsInput>
    connectOrCreate?: LocalMatchCreateOrConnectWithoutActionsInput
    connect?: LocalMatchWhereUniqueInput
  }

  export type LocalMatchUpdateOneRequiredWithoutActionsNestedInput = {
    create?: XOR<LocalMatchCreateWithoutActionsInput, LocalMatchUncheckedCreateWithoutActionsInput>
    connectOrCreate?: LocalMatchCreateOrConnectWithoutActionsInput
    upsert?: LocalMatchUpsertWithoutActionsInput
    connect?: LocalMatchWhereUniqueInput
    update?: XOR<XOR<LocalMatchUpdateToOneWithWhereWithoutActionsInput, LocalMatchUpdateWithoutActionsInput>, LocalMatchUncheckedUpdateWithoutActionsInput>
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

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
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

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
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

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
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

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
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
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchCreateNestedManyWithoutTeamBInput
  }

  export type TeamUncheckedCreateWithoutOwnerInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantUncheckedCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchUncheckedCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchUncheckedCreateNestedManyWithoutTeamBInput
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
    team?: string | null
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTeamSelectionsInput
    teamRef?: TeamCreateNestedOneWithoutSelectionsInput
  }

  export type TeamSelectionUncheckedCreateWithoutUserInput = {
    id?: string
    matchId: string
    team?: string | null
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

  export type CupCreateWithoutCreatorInput = {
    id?: string
    name: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    participants?: CupParticipantCreateNestedManyWithoutCupInput
    localMatches?: LocalMatchCreateNestedManyWithoutCupInput
  }

  export type CupUncheckedCreateWithoutCreatorInput = {
    id?: string
    name: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    participants?: CupParticipantUncheckedCreateNestedManyWithoutCupInput
    localMatches?: LocalMatchUncheckedCreateNestedManyWithoutCupInput
  }

  export type CupCreateOrConnectWithoutCreatorInput = {
    where: CupWhereUniqueInput
    create: XOR<CupCreateWithoutCreatorInput, CupUncheckedCreateWithoutCreatorInput>
  }

  export type CupCreateManyCreatorInputEnvelope = {
    data: CupCreateManyCreatorInput | CupCreateManyCreatorInput[]
  }

  export type LocalMatchCreateWithoutCreatorInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    teamA: TeamCreateNestedOneWithoutLocalMatchesAsTeamAInput
    teamB?: TeamCreateNestedOneWithoutLocalMatchesAsTeamBInput
    cup?: CupCreateNestedOneWithoutLocalMatchesInput
    actions?: LocalMatchActionCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchUncheckedCreateWithoutCreatorInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    teamAId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    actions?: LocalMatchActionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchCreateOrConnectWithoutCreatorInput = {
    where: LocalMatchWhereUniqueInput
    create: XOR<LocalMatchCreateWithoutCreatorInput, LocalMatchUncheckedCreateWithoutCreatorInput>
  }

  export type LocalMatchCreateManyCreatorInputEnvelope = {
    data: LocalMatchCreateManyCreatorInput | LocalMatchCreateManyCreatorInput[]
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
    treasury?: IntFilter<"Team"> | number
    rerolls?: IntFilter<"Team"> | number
    cheerleaders?: IntFilter<"Team"> | number
    assistants?: IntFilter<"Team"> | number
    apothecary?: BoolFilter<"Team"> | boolean
    dedicatedFans?: IntFilter<"Team"> | number
    teamValue?: IntFilter<"Team"> | number
    currentValue?: IntFilter<"Team"> | number
    initialBudget?: IntFilter<"Team"> | number
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
    team?: StringNullableFilter<"TeamSelection"> | string | null
    teamId?: StringNullableFilter<"TeamSelection"> | string | null
    createdAt?: DateTimeFilter<"TeamSelection"> | Date | string
  }

  export type CupUpsertWithWhereUniqueWithoutCreatorInput = {
    where: CupWhereUniqueInput
    update: XOR<CupUpdateWithoutCreatorInput, CupUncheckedUpdateWithoutCreatorInput>
    create: XOR<CupCreateWithoutCreatorInput, CupUncheckedCreateWithoutCreatorInput>
  }

  export type CupUpdateWithWhereUniqueWithoutCreatorInput = {
    where: CupWhereUniqueInput
    data: XOR<CupUpdateWithoutCreatorInput, CupUncheckedUpdateWithoutCreatorInput>
  }

  export type CupUpdateManyWithWhereWithoutCreatorInput = {
    where: CupScalarWhereInput
    data: XOR<CupUpdateManyMutationInput, CupUncheckedUpdateManyWithoutCreatorInput>
  }

  export type CupScalarWhereInput = {
    AND?: CupScalarWhereInput | CupScalarWhereInput[]
    OR?: CupScalarWhereInput[]
    NOT?: CupScalarWhereInput | CupScalarWhereInput[]
    id?: StringFilter<"Cup"> | string
    name?: StringFilter<"Cup"> | string
    creatorId?: StringFilter<"Cup"> | string
    validated?: BoolFilter<"Cup"> | boolean
    isPublic?: BoolFilter<"Cup"> | boolean
    status?: StringFilter<"Cup"> | string
    createdAt?: DateTimeFilter<"Cup"> | Date | string
    updatedAt?: DateTimeFilter<"Cup"> | Date | string
  }

  export type LocalMatchUpsertWithWhereUniqueWithoutCreatorInput = {
    where: LocalMatchWhereUniqueInput
    update: XOR<LocalMatchUpdateWithoutCreatorInput, LocalMatchUncheckedUpdateWithoutCreatorInput>
    create: XOR<LocalMatchCreateWithoutCreatorInput, LocalMatchUncheckedCreateWithoutCreatorInput>
  }

  export type LocalMatchUpdateWithWhereUniqueWithoutCreatorInput = {
    where: LocalMatchWhereUniqueInput
    data: XOR<LocalMatchUpdateWithoutCreatorInput, LocalMatchUncheckedUpdateWithoutCreatorInput>
  }

  export type LocalMatchUpdateManyWithWhereWithoutCreatorInput = {
    where: LocalMatchScalarWhereInput
    data: XOR<LocalMatchUpdateManyMutationInput, LocalMatchUncheckedUpdateManyWithoutCreatorInput>
  }

  export type LocalMatchScalarWhereInput = {
    AND?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
    OR?: LocalMatchScalarWhereInput[]
    NOT?: LocalMatchScalarWhereInput | LocalMatchScalarWhereInput[]
    id?: StringFilter<"LocalMatch"> | string
    name?: StringNullableFilter<"LocalMatch"> | string | null
    status?: StringFilter<"LocalMatch"> | string
    createdAt?: DateTimeFilter<"LocalMatch"> | Date | string
    updatedAt?: DateTimeFilter<"LocalMatch"> | Date | string
    startedAt?: DateTimeNullableFilter<"LocalMatch"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"LocalMatch"> | Date | string | null
    creatorId?: StringFilter<"LocalMatch"> | string
    teamAId?: StringFilter<"LocalMatch"> | string
    teamBId?: StringNullableFilter<"LocalMatch"> | string | null
    cupId?: StringNullableFilter<"LocalMatch"> | string | null
    shareToken?: StringNullableFilter<"LocalMatch"> | string | null
    teamAOwnerValidated?: BoolFilter<"LocalMatch"> | boolean
    teamBOwnerValidated?: BoolFilter<"LocalMatch"> | boolean
    gameState?: JsonNullableFilter<"LocalMatch">
    scoreTeamA?: IntNullableFilter<"LocalMatch"> | number | null
    scoreTeamB?: IntNullableFilter<"LocalMatch"> | number | null
  }

  export type UserCreateWithoutCreatedMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
    createdCups?: CupCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateWithoutCreatedMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
    createdCups?: CupUncheckedCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchUncheckedCreateNestedManyWithoutCreatorInput
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
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
    createdCups?: CupCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateWithoutMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
    createdCups?: CupUncheckedCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchUncheckedCreateNestedManyWithoutCreatorInput
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
    team?: string | null
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutTeamSelectionsInput
    teamRef?: TeamCreateNestedOneWithoutSelectionsInput
  }

  export type TeamSelectionUncheckedCreateWithoutMatchInput = {
    id?: string
    userId: string
    team?: string | null
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
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
    createdCups?: CupUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateWithoutCreatedMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
    createdCups?: CupUncheckedUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput
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
    coachName?: StringFilter<"User"> | string
    firstName?: StringNullableFilter<"User"> | string | null
    lastName?: StringNullableFilter<"User"> | string | null
    dateOfBirth?: DateTimeNullableFilter<"User"> | Date | string | null
    role?: StringFilter<"User"> | string
    roles?: StringFilter<"User"> | string
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
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    createdCups?: CupCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateWithoutTeamSelectionsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    createdCups?: CupUncheckedCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchUncheckedCreateNestedManyWithoutCreatorInput
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
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    cupParticipants?: CupParticipantCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchCreateNestedManyWithoutTeamBInput
  }

  export type TeamUncheckedCreateWithoutSelectionsInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    cupParticipants?: CupParticipantUncheckedCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchUncheckedCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchUncheckedCreateNestedManyWithoutTeamBInput
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
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    createdCups?: CupUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateWithoutTeamSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    createdCups?: CupUncheckedUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput
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
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    cupParticipants?: CupParticipantUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateWithoutSelectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    cupParticipants?: CupParticipantUncheckedUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUncheckedUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput
  }

  export type UserCreateWithoutTeamsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
    createdCups?: CupCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateWithoutTeamsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
    createdCups?: CupUncheckedCreateNestedManyWithoutCreatorInput
    createdLocalMatches?: LocalMatchUncheckedCreateNestedManyWithoutCreatorInput
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
    team?: string | null
    createdAt?: Date | string
    match: MatchCreateNestedOneWithoutTeamSelectionsInput
    user: UserCreateNestedOneWithoutTeamSelectionsInput
  }

  export type TeamSelectionUncheckedCreateWithoutTeamRefInput = {
    id?: string
    matchId: string
    userId: string
    team?: string | null
    createdAt?: Date | string
  }

  export type TeamSelectionCreateOrConnectWithoutTeamRefInput = {
    where: TeamSelectionWhereUniqueInput
    create: XOR<TeamSelectionCreateWithoutTeamRefInput, TeamSelectionUncheckedCreateWithoutTeamRefInput>
  }

  export type TeamSelectionCreateManyTeamRefInputEnvelope = {
    data: TeamSelectionCreateManyTeamRefInput | TeamSelectionCreateManyTeamRefInput[]
  }

  export type CupParticipantCreateWithoutTeamInput = {
    id?: string
    createdAt?: Date | string
    cup: CupCreateNestedOneWithoutParticipantsInput
  }

  export type CupParticipantUncheckedCreateWithoutTeamInput = {
    id?: string
    cupId: string
    createdAt?: Date | string
  }

  export type CupParticipantCreateOrConnectWithoutTeamInput = {
    where: CupParticipantWhereUniqueInput
    create: XOR<CupParticipantCreateWithoutTeamInput, CupParticipantUncheckedCreateWithoutTeamInput>
  }

  export type CupParticipantCreateManyTeamInputEnvelope = {
    data: CupParticipantCreateManyTeamInput | CupParticipantCreateManyTeamInput[]
  }

  export type LocalMatchCreateWithoutTeamAInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    creator: UserCreateNestedOneWithoutCreatedLocalMatchesInput
    teamB?: TeamCreateNestedOneWithoutLocalMatchesAsTeamBInput
    cup?: CupCreateNestedOneWithoutLocalMatchesInput
    actions?: LocalMatchActionCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchUncheckedCreateWithoutTeamAInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    actions?: LocalMatchActionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchCreateOrConnectWithoutTeamAInput = {
    where: LocalMatchWhereUniqueInput
    create: XOR<LocalMatchCreateWithoutTeamAInput, LocalMatchUncheckedCreateWithoutTeamAInput>
  }

  export type LocalMatchCreateManyTeamAInputEnvelope = {
    data: LocalMatchCreateManyTeamAInput | LocalMatchCreateManyTeamAInput[]
  }

  export type LocalMatchCreateWithoutTeamBInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    creator: UserCreateNestedOneWithoutCreatedLocalMatchesInput
    teamA: TeamCreateNestedOneWithoutLocalMatchesAsTeamAInput
    cup?: CupCreateNestedOneWithoutLocalMatchesInput
    actions?: LocalMatchActionCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchUncheckedCreateWithoutTeamBInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    actions?: LocalMatchActionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchCreateOrConnectWithoutTeamBInput = {
    where: LocalMatchWhereUniqueInput
    create: XOR<LocalMatchCreateWithoutTeamBInput, LocalMatchUncheckedCreateWithoutTeamBInput>
  }

  export type LocalMatchCreateManyTeamBInputEnvelope = {
    data: LocalMatchCreateManyTeamBInput | LocalMatchCreateManyTeamBInput[]
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
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
    createdCups?: CupUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateWithoutTeamsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
    createdCups?: CupUncheckedUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput
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

  export type CupParticipantUpsertWithWhereUniqueWithoutTeamInput = {
    where: CupParticipantWhereUniqueInput
    update: XOR<CupParticipantUpdateWithoutTeamInput, CupParticipantUncheckedUpdateWithoutTeamInput>
    create: XOR<CupParticipantCreateWithoutTeamInput, CupParticipantUncheckedCreateWithoutTeamInput>
  }

  export type CupParticipantUpdateWithWhereUniqueWithoutTeamInput = {
    where: CupParticipantWhereUniqueInput
    data: XOR<CupParticipantUpdateWithoutTeamInput, CupParticipantUncheckedUpdateWithoutTeamInput>
  }

  export type CupParticipantUpdateManyWithWhereWithoutTeamInput = {
    where: CupParticipantScalarWhereInput
    data: XOR<CupParticipantUpdateManyMutationInput, CupParticipantUncheckedUpdateManyWithoutTeamInput>
  }

  export type CupParticipantScalarWhereInput = {
    AND?: CupParticipantScalarWhereInput | CupParticipantScalarWhereInput[]
    OR?: CupParticipantScalarWhereInput[]
    NOT?: CupParticipantScalarWhereInput | CupParticipantScalarWhereInput[]
    id?: StringFilter<"CupParticipant"> | string
    cupId?: StringFilter<"CupParticipant"> | string
    teamId?: StringFilter<"CupParticipant"> | string
    createdAt?: DateTimeFilter<"CupParticipant"> | Date | string
  }

  export type LocalMatchUpsertWithWhereUniqueWithoutTeamAInput = {
    where: LocalMatchWhereUniqueInput
    update: XOR<LocalMatchUpdateWithoutTeamAInput, LocalMatchUncheckedUpdateWithoutTeamAInput>
    create: XOR<LocalMatchCreateWithoutTeamAInput, LocalMatchUncheckedCreateWithoutTeamAInput>
  }

  export type LocalMatchUpdateWithWhereUniqueWithoutTeamAInput = {
    where: LocalMatchWhereUniqueInput
    data: XOR<LocalMatchUpdateWithoutTeamAInput, LocalMatchUncheckedUpdateWithoutTeamAInput>
  }

  export type LocalMatchUpdateManyWithWhereWithoutTeamAInput = {
    where: LocalMatchScalarWhereInput
    data: XOR<LocalMatchUpdateManyMutationInput, LocalMatchUncheckedUpdateManyWithoutTeamAInput>
  }

  export type LocalMatchUpsertWithWhereUniqueWithoutTeamBInput = {
    where: LocalMatchWhereUniqueInput
    update: XOR<LocalMatchUpdateWithoutTeamBInput, LocalMatchUncheckedUpdateWithoutTeamBInput>
    create: XOR<LocalMatchCreateWithoutTeamBInput, LocalMatchUncheckedCreateWithoutTeamBInput>
  }

  export type LocalMatchUpdateWithWhereUniqueWithoutTeamBInput = {
    where: LocalMatchWhereUniqueInput
    data: XOR<LocalMatchUpdateWithoutTeamBInput, LocalMatchUncheckedUpdateWithoutTeamBInput>
  }

  export type LocalMatchUpdateManyWithWhereWithoutTeamBInput = {
    where: LocalMatchScalarWhereInput
    data: XOR<LocalMatchUpdateManyMutationInput, LocalMatchUncheckedUpdateManyWithoutTeamBInput>
  }

  export type TeamCreateWithoutPlayersInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    owner: UserCreateNestedOneWithoutTeamsInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchCreateNestedManyWithoutTeamBInput
  }

  export type TeamUncheckedCreateWithoutPlayersInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantUncheckedCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchUncheckedCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchUncheckedCreateNestedManyWithoutTeamBInput
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
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateWithoutPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUncheckedUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUncheckedUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput
  }

  export type UserCreateWithoutCreatedCupsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
    createdLocalMatches?: LocalMatchCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateWithoutCreatedCupsInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
    createdLocalMatches?: LocalMatchUncheckedCreateNestedManyWithoutCreatorInput
  }

  export type UserCreateOrConnectWithoutCreatedCupsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCreatedCupsInput, UserUncheckedCreateWithoutCreatedCupsInput>
  }

  export type CupParticipantCreateWithoutCupInput = {
    id?: string
    createdAt?: Date | string
    team: TeamCreateNestedOneWithoutCupParticipantsInput
  }

  export type CupParticipantUncheckedCreateWithoutCupInput = {
    id?: string
    teamId: string
    createdAt?: Date | string
  }

  export type CupParticipantCreateOrConnectWithoutCupInput = {
    where: CupParticipantWhereUniqueInput
    create: XOR<CupParticipantCreateWithoutCupInput, CupParticipantUncheckedCreateWithoutCupInput>
  }

  export type CupParticipantCreateManyCupInputEnvelope = {
    data: CupParticipantCreateManyCupInput | CupParticipantCreateManyCupInput[]
  }

  export type LocalMatchCreateWithoutCupInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    creator: UserCreateNestedOneWithoutCreatedLocalMatchesInput
    teamA: TeamCreateNestedOneWithoutLocalMatchesAsTeamAInput
    teamB?: TeamCreateNestedOneWithoutLocalMatchesAsTeamBInput
    actions?: LocalMatchActionCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchUncheckedCreateWithoutCupInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    teamBId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    actions?: LocalMatchActionUncheckedCreateNestedManyWithoutMatchInput
  }

  export type LocalMatchCreateOrConnectWithoutCupInput = {
    where: LocalMatchWhereUniqueInput
    create: XOR<LocalMatchCreateWithoutCupInput, LocalMatchUncheckedCreateWithoutCupInput>
  }

  export type LocalMatchCreateManyCupInputEnvelope = {
    data: LocalMatchCreateManyCupInput | LocalMatchCreateManyCupInput[]
  }

  export type UserUpsertWithoutCreatedCupsInput = {
    update: XOR<UserUpdateWithoutCreatedCupsInput, UserUncheckedUpdateWithoutCreatedCupsInput>
    create: XOR<UserCreateWithoutCreatedCupsInput, UserUncheckedCreateWithoutCreatedCupsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCreatedCupsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCreatedCupsInput, UserUncheckedUpdateWithoutCreatedCupsInput>
  }

  export type UserUpdateWithoutCreatedCupsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
    createdLocalMatches?: LocalMatchUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateWithoutCreatedCupsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
    createdLocalMatches?: LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput
  }

  export type CupParticipantUpsertWithWhereUniqueWithoutCupInput = {
    where: CupParticipantWhereUniqueInput
    update: XOR<CupParticipantUpdateWithoutCupInput, CupParticipantUncheckedUpdateWithoutCupInput>
    create: XOR<CupParticipantCreateWithoutCupInput, CupParticipantUncheckedCreateWithoutCupInput>
  }

  export type CupParticipantUpdateWithWhereUniqueWithoutCupInput = {
    where: CupParticipantWhereUniqueInput
    data: XOR<CupParticipantUpdateWithoutCupInput, CupParticipantUncheckedUpdateWithoutCupInput>
  }

  export type CupParticipantUpdateManyWithWhereWithoutCupInput = {
    where: CupParticipantScalarWhereInput
    data: XOR<CupParticipantUpdateManyMutationInput, CupParticipantUncheckedUpdateManyWithoutCupInput>
  }

  export type LocalMatchUpsertWithWhereUniqueWithoutCupInput = {
    where: LocalMatchWhereUniqueInput
    update: XOR<LocalMatchUpdateWithoutCupInput, LocalMatchUncheckedUpdateWithoutCupInput>
    create: XOR<LocalMatchCreateWithoutCupInput, LocalMatchUncheckedCreateWithoutCupInput>
  }

  export type LocalMatchUpdateWithWhereUniqueWithoutCupInput = {
    where: LocalMatchWhereUniqueInput
    data: XOR<LocalMatchUpdateWithoutCupInput, LocalMatchUncheckedUpdateWithoutCupInput>
  }

  export type LocalMatchUpdateManyWithWhereWithoutCupInput = {
    where: LocalMatchScalarWhereInput
    data: XOR<LocalMatchUpdateManyMutationInput, LocalMatchUncheckedUpdateManyWithoutCupInput>
  }

  export type CupCreateWithoutParticipantsInput = {
    id?: string
    name: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    creator: UserCreateNestedOneWithoutCreatedCupsInput
    localMatches?: LocalMatchCreateNestedManyWithoutCupInput
  }

  export type CupUncheckedCreateWithoutParticipantsInput = {
    id?: string
    name: string
    creatorId: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    localMatches?: LocalMatchUncheckedCreateNestedManyWithoutCupInput
  }

  export type CupCreateOrConnectWithoutParticipantsInput = {
    where: CupWhereUniqueInput
    create: XOR<CupCreateWithoutParticipantsInput, CupUncheckedCreateWithoutParticipantsInput>
  }

  export type TeamCreateWithoutCupParticipantsInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
    localMatchesAsTeamA?: LocalMatchCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchCreateNestedManyWithoutTeamBInput
  }

  export type TeamUncheckedCreateWithoutCupParticipantsInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
    localMatchesAsTeamA?: LocalMatchUncheckedCreateNestedManyWithoutTeamAInput
    localMatchesAsTeamB?: LocalMatchUncheckedCreateNestedManyWithoutTeamBInput
  }

  export type TeamCreateOrConnectWithoutCupParticipantsInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutCupParticipantsInput, TeamUncheckedCreateWithoutCupParticipantsInput>
  }

  export type CupUpsertWithoutParticipantsInput = {
    update: XOR<CupUpdateWithoutParticipantsInput, CupUncheckedUpdateWithoutParticipantsInput>
    create: XOR<CupCreateWithoutParticipantsInput, CupUncheckedCreateWithoutParticipantsInput>
    where?: CupWhereInput
  }

  export type CupUpdateToOneWithWhereWithoutParticipantsInput = {
    where?: CupWhereInput
    data: XOR<CupUpdateWithoutParticipantsInput, CupUncheckedUpdateWithoutParticipantsInput>
  }

  export type CupUpdateWithoutParticipantsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    creator?: UserUpdateOneRequiredWithoutCreatedCupsNestedInput
    localMatches?: LocalMatchUpdateManyWithoutCupNestedInput
  }

  export type CupUncheckedUpdateWithoutParticipantsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    creatorId?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    localMatches?: LocalMatchUncheckedUpdateManyWithoutCupNestedInput
  }

  export type TeamUpsertWithoutCupParticipantsInput = {
    update: XOR<TeamUpdateWithoutCupParticipantsInput, TeamUncheckedUpdateWithoutCupParticipantsInput>
    create: XOR<TeamCreateWithoutCupParticipantsInput, TeamUncheckedCreateWithoutCupParticipantsInput>
    where?: TeamWhereInput
  }

  export type TeamUpdateToOneWithWhereWithoutCupParticipantsInput = {
    where?: TeamWhereInput
    data: XOR<TeamUpdateWithoutCupParticipantsInput, TeamUncheckedUpdateWithoutCupParticipantsInput>
  }

  export type TeamUpdateWithoutCupParticipantsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
    localMatchesAsTeamA?: LocalMatchUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateWithoutCupParticipantsInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
    localMatchesAsTeamA?: LocalMatchUncheckedUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput
  }

  export type UserCreateWithoutCreatedLocalMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchCreateNestedManyWithoutCreatorInput
    teams?: TeamCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionCreateNestedManyWithoutUserInput
    createdCups?: CupCreateNestedManyWithoutCreatorInput
  }

  export type UserUncheckedCreateWithoutCreatedLocalMatchesInput = {
    id?: string
    email: string
    passwordHash: string
    name?: string | null
    coachName: string
    firstName?: string | null
    lastName?: string | null
    dateOfBirth?: Date | string | null
    role?: string
    roles?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    matches?: MatchUncheckedCreateNestedManyWithoutPlayersInput
    createdMatches?: MatchUncheckedCreateNestedManyWithoutCreatorInput
    teams?: TeamUncheckedCreateNestedManyWithoutOwnerInput
    teamSelections?: TeamSelectionUncheckedCreateNestedManyWithoutUserInput
    createdCups?: CupUncheckedCreateNestedManyWithoutCreatorInput
  }

  export type UserCreateOrConnectWithoutCreatedLocalMatchesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCreatedLocalMatchesInput, UserUncheckedCreateWithoutCreatedLocalMatchesInput>
  }

  export type TeamCreateWithoutLocalMatchesAsTeamAInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantCreateNestedManyWithoutTeamInput
    localMatchesAsTeamB?: LocalMatchCreateNestedManyWithoutTeamBInput
  }

  export type TeamUncheckedCreateWithoutLocalMatchesAsTeamAInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantUncheckedCreateNestedManyWithoutTeamInput
    localMatchesAsTeamB?: LocalMatchUncheckedCreateNestedManyWithoutTeamBInput
  }

  export type TeamCreateOrConnectWithoutLocalMatchesAsTeamAInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutLocalMatchesAsTeamAInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamAInput>
  }

  export type TeamCreateWithoutLocalMatchesAsTeamBInput = {
    id?: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    owner: UserCreateNestedOneWithoutTeamsInput
    players?: TeamPlayerCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchCreateNestedManyWithoutTeamAInput
  }

  export type TeamUncheckedCreateWithoutLocalMatchesAsTeamBInput = {
    id?: string
    ownerId: string
    name: string
    roster: string
    createdAt?: Date | string
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
    players?: TeamPlayerUncheckedCreateNestedManyWithoutTeamInput
    selections?: TeamSelectionUncheckedCreateNestedManyWithoutTeamRefInput
    cupParticipants?: CupParticipantUncheckedCreateNestedManyWithoutTeamInput
    localMatchesAsTeamA?: LocalMatchUncheckedCreateNestedManyWithoutTeamAInput
  }

  export type TeamCreateOrConnectWithoutLocalMatchesAsTeamBInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutLocalMatchesAsTeamBInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamBInput>
  }

  export type CupCreateWithoutLocalMatchesInput = {
    id?: string
    name: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    creator: UserCreateNestedOneWithoutCreatedCupsInput
    participants?: CupParticipantCreateNestedManyWithoutCupInput
  }

  export type CupUncheckedCreateWithoutLocalMatchesInput = {
    id?: string
    name: string
    creatorId: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    participants?: CupParticipantUncheckedCreateNestedManyWithoutCupInput
  }

  export type CupCreateOrConnectWithoutLocalMatchesInput = {
    where: CupWhereUniqueInput
    create: XOR<CupCreateWithoutLocalMatchesInput, CupUncheckedCreateWithoutLocalMatchesInput>
  }

  export type LocalMatchActionCreateWithoutMatchInput = {
    id?: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId?: string | null
    opponentName?: string | null
    diceResult?: number | null
    fumble?: boolean
    playerState?: string | null
    armorBroken?: boolean
    opponentState?: string | null
    passType?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocalMatchActionUncheckedCreateWithoutMatchInput = {
    id?: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId?: string | null
    opponentName?: string | null
    diceResult?: number | null
    fumble?: boolean
    playerState?: string | null
    armorBroken?: boolean
    opponentState?: string | null
    passType?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocalMatchActionCreateOrConnectWithoutMatchInput = {
    where: LocalMatchActionWhereUniqueInput
    create: XOR<LocalMatchActionCreateWithoutMatchInput, LocalMatchActionUncheckedCreateWithoutMatchInput>
  }

  export type LocalMatchActionCreateManyMatchInputEnvelope = {
    data: LocalMatchActionCreateManyMatchInput | LocalMatchActionCreateManyMatchInput[]
  }

  export type UserUpsertWithoutCreatedLocalMatchesInput = {
    update: XOR<UserUpdateWithoutCreatedLocalMatchesInput, UserUncheckedUpdateWithoutCreatedLocalMatchesInput>
    create: XOR<UserCreateWithoutCreatedLocalMatchesInput, UserUncheckedCreateWithoutCreatedLocalMatchesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCreatedLocalMatchesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCreatedLocalMatchesInput, UserUncheckedUpdateWithoutCreatedLocalMatchesInput>
  }

  export type UserUpdateWithoutCreatedLocalMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
    createdCups?: CupUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateWithoutCreatedLocalMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matches?: MatchUncheckedUpdateManyWithoutPlayersNestedInput
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
    createdCups?: CupUncheckedUpdateManyWithoutCreatorNestedInput
  }

  export type TeamUpsertWithoutLocalMatchesAsTeamAInput = {
    update: XOR<TeamUpdateWithoutLocalMatchesAsTeamAInput, TeamUncheckedUpdateWithoutLocalMatchesAsTeamAInput>
    create: XOR<TeamCreateWithoutLocalMatchesAsTeamAInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamAInput>
    where?: TeamWhereInput
  }

  export type TeamUpdateToOneWithWhereWithoutLocalMatchesAsTeamAInput = {
    where?: TeamWhereInput
    data: XOR<TeamUpdateWithoutLocalMatchesAsTeamAInput, TeamUncheckedUpdateWithoutLocalMatchesAsTeamAInput>
  }

  export type TeamUpdateWithoutLocalMatchesAsTeamAInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamB?: LocalMatchUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateWithoutLocalMatchesAsTeamAInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUncheckedUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamB?: LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUpsertWithoutLocalMatchesAsTeamBInput = {
    update: XOR<TeamUpdateWithoutLocalMatchesAsTeamBInput, TeamUncheckedUpdateWithoutLocalMatchesAsTeamBInput>
    create: XOR<TeamCreateWithoutLocalMatchesAsTeamBInput, TeamUncheckedCreateWithoutLocalMatchesAsTeamBInput>
    where?: TeamWhereInput
  }

  export type TeamUpdateToOneWithWhereWithoutLocalMatchesAsTeamBInput = {
    where?: TeamWhereInput
    data: XOR<TeamUpdateWithoutLocalMatchesAsTeamBInput, TeamUncheckedUpdateWithoutLocalMatchesAsTeamBInput>
  }

  export type TeamUpdateWithoutLocalMatchesAsTeamBInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    owner?: UserUpdateOneRequiredWithoutTeamsNestedInput
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUpdateManyWithoutTeamANestedInput
  }

  export type TeamUncheckedUpdateWithoutLocalMatchesAsTeamBInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUncheckedUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUncheckedUpdateManyWithoutTeamANestedInput
  }

  export type CupUpsertWithoutLocalMatchesInput = {
    update: XOR<CupUpdateWithoutLocalMatchesInput, CupUncheckedUpdateWithoutLocalMatchesInput>
    create: XOR<CupCreateWithoutLocalMatchesInput, CupUncheckedCreateWithoutLocalMatchesInput>
    where?: CupWhereInput
  }

  export type CupUpdateToOneWithWhereWithoutLocalMatchesInput = {
    where?: CupWhereInput
    data: XOR<CupUpdateWithoutLocalMatchesInput, CupUncheckedUpdateWithoutLocalMatchesInput>
  }

  export type CupUpdateWithoutLocalMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    creator?: UserUpdateOneRequiredWithoutCreatedCupsNestedInput
    participants?: CupParticipantUpdateManyWithoutCupNestedInput
  }

  export type CupUncheckedUpdateWithoutLocalMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    creatorId?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    participants?: CupParticipantUncheckedUpdateManyWithoutCupNestedInput
  }

  export type LocalMatchActionUpsertWithWhereUniqueWithoutMatchInput = {
    where: LocalMatchActionWhereUniqueInput
    update: XOR<LocalMatchActionUpdateWithoutMatchInput, LocalMatchActionUncheckedUpdateWithoutMatchInput>
    create: XOR<LocalMatchActionCreateWithoutMatchInput, LocalMatchActionUncheckedCreateWithoutMatchInput>
  }

  export type LocalMatchActionUpdateWithWhereUniqueWithoutMatchInput = {
    where: LocalMatchActionWhereUniqueInput
    data: XOR<LocalMatchActionUpdateWithoutMatchInput, LocalMatchActionUncheckedUpdateWithoutMatchInput>
  }

  export type LocalMatchActionUpdateManyWithWhereWithoutMatchInput = {
    where: LocalMatchActionScalarWhereInput
    data: XOR<LocalMatchActionUpdateManyMutationInput, LocalMatchActionUncheckedUpdateManyWithoutMatchInput>
  }

  export type LocalMatchActionScalarWhereInput = {
    AND?: LocalMatchActionScalarWhereInput | LocalMatchActionScalarWhereInput[]
    OR?: LocalMatchActionScalarWhereInput[]
    NOT?: LocalMatchActionScalarWhereInput | LocalMatchActionScalarWhereInput[]
    id?: StringFilter<"LocalMatchAction"> | string
    matchId?: StringFilter<"LocalMatchAction"> | string
    half?: IntFilter<"LocalMatchAction"> | number
    turn?: IntFilter<"LocalMatchAction"> | number
    actionType?: StringFilter<"LocalMatchAction"> | string
    playerId?: StringFilter<"LocalMatchAction"> | string
    playerName?: StringFilter<"LocalMatchAction"> | string
    playerTeam?: StringFilter<"LocalMatchAction"> | string
    opponentId?: StringNullableFilter<"LocalMatchAction"> | string | null
    opponentName?: StringNullableFilter<"LocalMatchAction"> | string | null
    diceResult?: IntNullableFilter<"LocalMatchAction"> | number | null
    fumble?: BoolFilter<"LocalMatchAction"> | boolean
    playerState?: StringNullableFilter<"LocalMatchAction"> | string | null
    armorBroken?: BoolFilter<"LocalMatchAction"> | boolean
    opponentState?: StringNullableFilter<"LocalMatchAction"> | string | null
    passType?: StringNullableFilter<"LocalMatchAction"> | string | null
    createdAt?: DateTimeFilter<"LocalMatchAction"> | Date | string
    updatedAt?: DateTimeFilter<"LocalMatchAction"> | Date | string
  }

  export type LocalMatchCreateWithoutActionsInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
    creator: UserCreateNestedOneWithoutCreatedLocalMatchesInput
    teamA: TeamCreateNestedOneWithoutLocalMatchesAsTeamAInput
    teamB?: TeamCreateNestedOneWithoutLocalMatchesAsTeamBInput
    cup?: CupCreateNestedOneWithoutLocalMatchesInput
  }

  export type LocalMatchUncheckedCreateWithoutActionsInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
  }

  export type LocalMatchCreateOrConnectWithoutActionsInput = {
    where: LocalMatchWhereUniqueInput
    create: XOR<LocalMatchCreateWithoutActionsInput, LocalMatchUncheckedCreateWithoutActionsInput>
  }

  export type LocalMatchUpsertWithoutActionsInput = {
    update: XOR<LocalMatchUpdateWithoutActionsInput, LocalMatchUncheckedUpdateWithoutActionsInput>
    create: XOR<LocalMatchCreateWithoutActionsInput, LocalMatchUncheckedCreateWithoutActionsInput>
    where?: LocalMatchWhereInput
  }

  export type LocalMatchUpdateToOneWithWhereWithoutActionsInput = {
    where?: LocalMatchWhereInput
    data: XOR<LocalMatchUpdateWithoutActionsInput, LocalMatchUncheckedUpdateWithoutActionsInput>
  }

  export type LocalMatchUpdateWithoutActionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    creator?: UserUpdateOneRequiredWithoutCreatedLocalMatchesNestedInput
    teamA?: TeamUpdateOneRequiredWithoutLocalMatchesAsTeamANestedInput
    teamB?: TeamUpdateOneWithoutLocalMatchesAsTeamBNestedInput
    cup?: CupUpdateOneWithoutLocalMatchesNestedInput
  }

  export type LocalMatchUncheckedUpdateWithoutActionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
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
    treasury?: number
    rerolls?: number
    cheerleaders?: number
    assistants?: number
    apothecary?: boolean
    dedicatedFans?: number
    teamValue?: number
    currentValue?: number
    initialBudget?: number
  }

  export type TeamSelectionCreateManyUserInput = {
    id?: string
    matchId: string
    team?: string | null
    teamId?: string | null
    createdAt?: Date | string
  }

  export type CupCreateManyCreatorInput = {
    id?: string
    name: string
    validated?: boolean
    isPublic?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocalMatchCreateManyCreatorInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    teamAId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
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
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
    players?: TeamPlayerUncheckedUpdateManyWithoutTeamNestedInput
    selections?: TeamSelectionUncheckedUpdateManyWithoutTeamRefNestedInput
    cupParticipants?: CupParticipantUncheckedUpdateManyWithoutTeamNestedInput
    localMatchesAsTeamA?: LocalMatchUncheckedUpdateManyWithoutTeamANestedInput
    localMatchesAsTeamB?: LocalMatchUncheckedUpdateManyWithoutTeamBNestedInput
  }

  export type TeamUncheckedUpdateManyWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    roster?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    treasury?: IntFieldUpdateOperationsInput | number
    rerolls?: IntFieldUpdateOperationsInput | number
    cheerleaders?: IntFieldUpdateOperationsInput | number
    assistants?: IntFieldUpdateOperationsInput | number
    apothecary?: BoolFieldUpdateOperationsInput | boolean
    dedicatedFans?: IntFieldUpdateOperationsInput | number
    teamValue?: IntFieldUpdateOperationsInput | number
    currentValue?: IntFieldUpdateOperationsInput | number
    initialBudget?: IntFieldUpdateOperationsInput | number
  }

  export type TeamSelectionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput
    teamRef?: TeamUpdateOneWithoutSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupUpdateWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    participants?: CupParticipantUpdateManyWithoutCupNestedInput
    localMatches?: LocalMatchUpdateManyWithoutCupNestedInput
  }

  export type CupUncheckedUpdateWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    participants?: CupParticipantUncheckedUpdateManyWithoutCupNestedInput
    localMatches?: LocalMatchUncheckedUpdateManyWithoutCupNestedInput
  }

  export type CupUncheckedUpdateManyWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    validated?: BoolFieldUpdateOperationsInput | boolean
    isPublic?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchUpdateWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    teamA?: TeamUpdateOneRequiredWithoutLocalMatchesAsTeamANestedInput
    teamB?: TeamUpdateOneWithoutLocalMatchesAsTeamBNestedInput
    cup?: CupUpdateOneWithoutLocalMatchesNestedInput
    actions?: LocalMatchActionUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    actions?: LocalMatchActionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateManyWithoutCreatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
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
    team?: string | null
    teamId?: string | null
    createdAt?: Date | string
  }

  export type UserUpdateWithoutMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdMatches?: MatchUpdateManyWithoutCreatorNestedInput
    teams?: TeamUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUpdateManyWithoutUserNestedInput
    createdCups?: CupUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateWithoutMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdMatches?: MatchUncheckedUpdateManyWithoutCreatorNestedInput
    teams?: TeamUncheckedUpdateManyWithoutOwnerNestedInput
    teamSelections?: TeamSelectionUncheckedUpdateManyWithoutUserNestedInput
    createdCups?: CupUncheckedUpdateManyWithoutCreatorNestedInput
    createdLocalMatches?: LocalMatchUncheckedUpdateManyWithoutCreatorNestedInput
  }

  export type UserUncheckedUpdateManyWithoutMatchesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    coachName?: StringFieldUpdateOperationsInput | string
    firstName?: NullableStringFieldUpdateOperationsInput | string | null
    lastName?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: StringFieldUpdateOperationsInput | string
    roles?: StringFieldUpdateOperationsInput | string
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
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutTeamSelectionsNestedInput
    teamRef?: TeamUpdateOneWithoutSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
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
    team?: string | null
    createdAt?: Date | string
  }

  export type CupParticipantCreateManyTeamInput = {
    id?: string
    cupId: string
    createdAt?: Date | string
  }

  export type LocalMatchCreateManyTeamAInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamBId?: string | null
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
  }

  export type LocalMatchCreateManyTeamBInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    cupId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
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
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    match?: MatchUpdateOneRequiredWithoutTeamSelectionsNestedInput
    user?: UserUpdateOneRequiredWithoutTeamSelectionsNestedInput
  }

  export type TeamSelectionUncheckedUpdateWithoutTeamRefInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamSelectionUncheckedUpdateManyWithoutTeamRefInput = {
    id?: StringFieldUpdateOperationsInput | string
    matchId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    team?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupParticipantUpdateWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cup?: CupUpdateOneRequiredWithoutParticipantsNestedInput
  }

  export type CupParticipantUncheckedUpdateWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    cupId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupParticipantUncheckedUpdateManyWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    cupId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchUpdateWithoutTeamAInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    creator?: UserUpdateOneRequiredWithoutCreatedLocalMatchesNestedInput
    teamB?: TeamUpdateOneWithoutLocalMatchesAsTeamBNestedInput
    cup?: CupUpdateOneWithoutLocalMatchesNestedInput
    actions?: LocalMatchActionUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateWithoutTeamAInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    actions?: LocalMatchActionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateManyWithoutTeamAInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type LocalMatchUpdateWithoutTeamBInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    creator?: UserUpdateOneRequiredWithoutCreatedLocalMatchesNestedInput
    teamA?: TeamUpdateOneRequiredWithoutLocalMatchesAsTeamANestedInput
    cup?: CupUpdateOneWithoutLocalMatchesNestedInput
    actions?: LocalMatchActionUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateWithoutTeamBInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    actions?: LocalMatchActionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateManyWithoutTeamBInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    cupId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type CupParticipantCreateManyCupInput = {
    id?: string
    teamId: string
    createdAt?: Date | string
  }

  export type LocalMatchCreateManyCupInput = {
    id?: string
    name?: string | null
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    creatorId: string
    teamAId: string
    teamBId?: string | null
    shareToken?: string | null
    teamAOwnerValidated?: boolean
    teamBOwnerValidated?: boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: number | null
    scoreTeamB?: number | null
  }

  export type CupParticipantUpdateWithoutCupInput = {
    id?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    team?: TeamUpdateOneRequiredWithoutCupParticipantsNestedInput
  }

  export type CupParticipantUncheckedUpdateWithoutCupInput = {
    id?: StringFieldUpdateOperationsInput | string
    teamId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CupParticipantUncheckedUpdateManyWithoutCupInput = {
    id?: StringFieldUpdateOperationsInput | string
    teamId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchUpdateWithoutCupInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    creator?: UserUpdateOneRequiredWithoutCreatedLocalMatchesNestedInput
    teamA?: TeamUpdateOneRequiredWithoutLocalMatchesAsTeamANestedInput
    teamB?: TeamUpdateOneWithoutLocalMatchesAsTeamBNestedInput
    actions?: LocalMatchActionUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateWithoutCupInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
    actions?: LocalMatchActionUncheckedUpdateManyWithoutMatchNestedInput
  }

  export type LocalMatchUncheckedUpdateManyWithoutCupInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    creatorId?: StringFieldUpdateOperationsInput | string
    teamAId?: StringFieldUpdateOperationsInput | string
    teamBId?: NullableStringFieldUpdateOperationsInput | string | null
    shareToken?: NullableStringFieldUpdateOperationsInput | string | null
    teamAOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    teamBOwnerValidated?: BoolFieldUpdateOperationsInput | boolean
    gameState?: NullableJsonNullValueInput | InputJsonValue
    scoreTeamA?: NullableIntFieldUpdateOperationsInput | number | null
    scoreTeamB?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type LocalMatchActionCreateManyMatchInput = {
    id?: string
    half: number
    turn: number
    actionType: string
    playerId: string
    playerName: string
    playerTeam: string
    opponentId?: string | null
    opponentName?: string | null
    diceResult?: number | null
    fumble?: boolean
    playerState?: string | null
    armorBroken?: boolean
    opponentState?: string | null
    passType?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocalMatchActionUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchActionUncheckedUpdateWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocalMatchActionUncheckedUpdateManyWithoutMatchInput = {
    id?: StringFieldUpdateOperationsInput | string
    half?: IntFieldUpdateOperationsInput | number
    turn?: IntFieldUpdateOperationsInput | number
    actionType?: StringFieldUpdateOperationsInput | string
    playerId?: StringFieldUpdateOperationsInput | string
    playerName?: StringFieldUpdateOperationsInput | string
    playerTeam?: StringFieldUpdateOperationsInput | string
    opponentId?: NullableStringFieldUpdateOperationsInput | string | null
    opponentName?: NullableStringFieldUpdateOperationsInput | string | null
    diceResult?: NullableIntFieldUpdateOperationsInput | number | null
    fumble?: BoolFieldUpdateOperationsInput | boolean
    playerState?: NullableStringFieldUpdateOperationsInput | string | null
    armorBroken?: BoolFieldUpdateOperationsInput | boolean
    opponentState?: NullableStringFieldUpdateOperationsInput | string | null
    passType?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
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