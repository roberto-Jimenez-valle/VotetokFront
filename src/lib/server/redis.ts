import { createClient, type RedisClientType } from 'redis';
import { building } from '$app/environment';

// ===============================================
// CONFIGURACIÓN DE REDIS
// ===============================================

interface RedisConfig {
  url: string;
  retryStrategy?: (times: number) => number;
  socket?: {
    reconnectStrategy?: (retries: number) => number | Error;
    connectTimeout?: number;
    keepAlive?: number;
  };
}

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private config: RedisConfig;

  constructor() {
    this.config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        keepAlive: 30000,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error('[Redis] Max reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    };
  }

  /**
   * Inicializar conexión a Redis
   */
  async init(): Promise<void> {
    if (building) return; // No conectar durante build
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.connect();
    return this.connectionPromise;
  }

  /**
   * Conectar a Redis
   */
  private async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: this.config.url,
        socket: this.config.socket
      });

      // Event handlers
      this.client.on('error', (err) => {
        console.error('[Redis] Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('[Redis] Ready');
      });

      this.client.on('end', () => {
        console.log('[Redis] Connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('[Redis] Connection failed:', error);
      this.client = null;
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Verificar si Redis está disponible
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Obtener valor del cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client!.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Redis] Error getting ${key}:`, error);
      return null;
    }
  }

  /**
   * Establecer valor en cache
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client!.setEx(key, ttl, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Establecer con expiración en segundos
   */
  async setex(key: string, seconds: number, value: any): Promise<boolean> {
    return this.set(key, value, seconds);
  }

  /**
   * Eliminar del cache
   */
  async del(key: string | string[]): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const keys = Array.isArray(key) ? key : [key];
      return await this.client!.del(keys);
    } catch (error) {
      console.error(`[Redis] Error deleting ${key}:`, error);
      return 0;
    }
  }

  /**
   * Verificar si existe una clave
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Error checking exists ${key}:`, error);
      return false;
    }
  }

  /**
   * Obtener TTL de una clave
   */
  async ttl(key: string): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      console.error(`[Redis] Error getting TTL for ${key}:`, error);
      return null;
    }
  }

  /**
   * Establecer expiración de una clave en segundos
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      return await this.client!.expire(key, seconds);
    } catch (error) {
      console.error(`[Redis] Error setting expiration for ${key}:`, error);
      return false;
    }
  }

  /**
   * Sorted Set: Remove range by score
   */
  async zRemRangeByScore(key: string, min: string | number, max: string | number): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      return await this.client!.zRemRangeByScore(key, min, max);
    } catch (error) {
      console.error(`[Redis] Error removing range by score ${key}:`, error);
      return 0;
    }
  }

  /**
   * Sorted Set: Get cardinality
   */
  async zCard(key: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      return await this.client!.zCard(key);
    } catch (error) {
      console.error(`[Redis] Error getting zCard ${key}:`, error);
      return 0;
    }
  }

  /**
   * Sorted Set: Add member
   */
  async zAdd(key: string, member: { score: number; value: string }): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      return await this.client!.zAdd(key, member);
    } catch (error) {
      console.error(`[Redis] Error adding to sorted set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Sorted Set: Get range
   */
  async zRange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isAvailable()) return [];

    try {
      return await this.client!.zRange(key, start, stop);
    } catch (error) {
      console.error(`[Redis] Error getting zRange ${key}:`, error);
      return [];
    }
  }

  /**
   * Incrementar contador
   */
  async incr(key: string): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.incr(key);
    } catch (error) {
      console.error(`[Redis] Error incrementing ${key}:`, error);
      return null;
    }
  }

  /**
   * Decrementar contador
   */
  async decr(key: string): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.decr(key);
    } catch (error) {
      console.error(`[Redis] Error decrementing ${key}:`, error);
      return null;
    }
  }

  /**
   * Agregar a lista
   */
  async lpush(key: string, ...values: any[]): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const serialized = values.map(v => JSON.stringify(v));
      return await this.client!.lPush(key, serialized);
    } catch (error) {
      console.error(`[Redis] Error pushing to list ${key}:`, error);
      return null;
    }
  }

  /**
   * Obtener elementos de lista
   */
  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    if (!this.isAvailable()) return [];

    try {
      const values = await this.client!.lRange(key, start, stop);
      return values.map(v => JSON.parse(v));
    } catch (error) {
      console.error(`[Redis] Error getting list range ${key}:`, error);
      return [];
    }
  }

  /**
   * Agregar a set
   */
  async sadd(key: string, ...members: any[]): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const serialized = members.map(m => JSON.stringify(m));
      return await this.client!.sAdd(key, serialized);
    } catch (error) {
      console.error(`[Redis] Error adding to set ${key}:`, error);
      return null;
    }
  }

  /**
   * Obtener miembros de set
   */
  async smembers(key: string): Promise<any[]> {
    if (!this.isAvailable()) return [];

    try {
      const members = await this.client!.sMembers(key);
      return members.map(m => JSON.parse(m));
    } catch (error) {
      console.error(`[Redis] Error getting set members ${key}:`, error);
      return [];
    }
  }

  /**
   * Establecer hash
   */
  async hset(key: string, field: string, value: any): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const serialized = JSON.stringify(value);
      return await this.client!.hSet(key, field, serialized);
    } catch (error) {
      console.error(`[Redis] Error setting hash ${key}:${field}:`, error);
      return null;
    }
  }

  /**
   * Obtener campo de hash
   */
  async hget(key: string, field: string): Promise<any | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client!.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Redis] Error getting hash ${key}:${field}:`, error);
      return null;
    }
  }

  /**
   * Obtener todo el hash
   */
  async hgetall(key: string): Promise<Record<string, any>> {
    if (!this.isAvailable()) return {};

    try {
      const hash = await this.client!.hGetAll(key);
      const result: Record<string, any> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      console.error(`[Redis] Error getting hash ${key}:`, error);
      return {};
    }
  }

  /**
   * Publicar mensaje en canal
   */
  async publish(channel: string, message: any): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const serialized = JSON.stringify(message);
      return await this.client!.publish(channel, serialized);
    } catch (error) {
      console.error(`[Redis] Error publishing to ${channel}:`, error);
      return null;
    }
  }

  /**
   * Limpiar todo el cache
   */
  async flushall(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.client!.flushAll();
      console.log('[Redis] Cache cleared');
    } catch (error) {
      console.error('[Redis] Error flushing cache:', error);
    }
  }

  /**
   * Cerrar conexión
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      this.connectionPromise = null;
      console.log('[Redis] Disconnected');
    }
  }

  /**
   * Obtener información del servidor
   */
  async info(): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.info();
    } catch (error) {
      console.error('[Redis] Error getting info:', error);
      return null;
    }
  }

  /**
   * Ping al servidor
   */
  async ping(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('[Redis] Ping failed:', error);
      return false;
    }
  }
}

// ===============================================
// HELPER FUNCTIONS
// ===============================================

/**
 * Cache decorator para funciones
 */
export function cached(ttl: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = `cache:${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      // Intentar obtener del cache
      const cached = await redis.get(key);
      if (cached !== null) {
        console.log(`[Cache] Hit: ${key}`);
        return cached;
      }

      // Ejecutar función original
      const result = await originalMethod.apply(this, args);
      
      // Guardar en cache
      await redis.setex(key, ttl, result);
      console.log(`[Cache] Set: ${key} (TTL: ${ttl}s)`);
      
      return result;
    };

    return descriptor;
  };
}

/**
 * Invalidar cache por patrón
 */
export async function invalidateCache(pattern: string): Promise<number> {
  if (!redis.isAvailable()) return 0;
  
  // Redis no soporta wildcards en DEL, necesitamos SCAN
  // Esta es una implementación simplificada
  console.log(`[Cache] Invalidating pattern: ${pattern}`);
  
  // Por ahora, retornar 0
  // En producción, usar SCAN para buscar y eliminar claves
  return 0;
}

/**
 * Cache para resultados de queries
 */
export async function cacheQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Intentar obtener del cache
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache] Query hit: ${key}`);
    return cached;
  }

  // Ejecutar query
  const result = await queryFn();
  
  // Guardar en cache
  await redis.setex(key, ttl, result);
  console.log(`[Cache] Query cached: ${key} (TTL: ${ttl}s)`);
  
  return result;
}

// ===============================================
// RATE LIMITING CON REDIS
// ===============================================

export async function rateLimit(
  identifier: string,
  limit: number = 60,
  window: number = 60
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const key = `rate:${identifier}`;
  const now = Date.now();
  const windowStart = now - (window * 1000);

  if (!redis.isAvailable()) {
    // Si Redis no está disponible, permitir todo
    return { allowed: true, remaining: limit, reset: 0 };
  }

  try {
    // Usar sorted set para ventana deslizante
    // Eliminar entradas antiguas
    await redis.zRemRangeByScore(key, '-inf', windowStart.toString());
    
    // Contar requests en la ventana
    const count = await redis.zCard(key);
    
    if (count < limit) {
      // Agregar nueva entrada
      await redis.zAdd(key, { score: now, value: now.toString() });
      await redis.expire(key, window);
      
      return {
        allowed: true,
        remaining: limit - count - 1,
        reset: now + (window * 1000)
      };
    } else {
      // Rate limit excedido
      const oldestEntry = await redis.zRange(key, 0, 0);
      const reset = oldestEntry.length > 0 
        ? parseInt(oldestEntry[0]) + (window * 1000)
        : now + (window * 1000);
      
      return {
        allowed: false,
        remaining: 0,
        reset
      };
    }
  } catch (error) {
    console.error('[Redis] Rate limit error:', error);
    // En caso de error, permitir
    return { allowed: true, remaining: limit, reset: 0 };
  }
}

// ===============================================
// SESSION STORAGE
// ===============================================

export async function getSession(sessionId: string): Promise<any | null> {
  const key = `session:${sessionId}`;
  return redis.get(key);
}

export async function setSession(sessionId: string, data: any, ttl = 86400): Promise<boolean> {
  const key = `session:${sessionId}`;
  return redis.setex(key, ttl, data);
}

export async function deleteSession(sessionId: string): Promise<number> {
  const key = `session:${sessionId}`;
  return redis.del(key);
}

// ===============================================
// INSTANCIA SINGLETON
// ===============================================

export const redis = new RedisCache();

// Auto-inicializar si no es build time
if (!building) {
  redis.init().catch(err => {
    console.error('[Redis] Failed to initialize:', err);
  });
}

export default redis;
