import { connect } from 'node:tls';

const PROBE_TIMEOUT_MS = 8_000;

/**
 * Explains why a Redis URL doesn't work, without ever including the
 * password. ioredis hides Upstash's AUTH failure behind silent reconnects,
 * so this opens its own TLS connection, sends AUTH by hand and reports the
 * server's literal reply, plus harmless facts about the credential (length,
 * stray whitespace/quotes) that tell a mistyped password from a REST token.
 */
export async function diagnoseRedisUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'REDIS_URL is not a valid URL.';
  }

  const password = decodeURIComponent(parsed.password);
  const username = decodeURIComponent(parsed.username) || 'default';
  const facts = [
    `scheme=${parsed.protocol.replace(':', '')}`,
    `host=${parsed.hostname}`,
    `port=${parsed.port || '(none)'}`,
    `user=${username}`,
    `password length=${password.length}`,
  ];
  if (url !== url.trim()) facts.push('URL has leading/trailing whitespace');
  if (/^["']|["']$/.test(url.trim())) facts.push('URL is wrapped in quotes');
  if (!password) return `${facts.join(', ')}. The URL has no password.`;
  if (parsed.protocol !== 'rediss:') {
    return `${facts.join(', ')}. Upstash requires TLS: use rediss://.`;
  }

  const reply = await authReply(
    parsed.hostname,
    Number(parsed.port || 6379),
    username,
    password,
  );
  return `${facts.join(', ')}. Server reply to AUTH: ${reply}`;
}

function authReply(
  host: string,
  port: number,
  username: string,
  password: string,
): Promise<string> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, servername: host });
    const done = (result: string) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS, () => done('(no reply, timed out)'));
    socket.on('error', (error: Error) =>
      done(`(connection error: ${error.message})`),
    );
    socket.on('secureConnect', () => {
      const args = ['AUTH', username, password];
      socket.write(
        `*${args.length}\r\n` +
          args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join(''),
      );
    });
    socket.on('data', (data: Buffer) =>
      done(data.toString().split('\r\n')[0].replace(password, '***')),
    );
    socket.on('close', () => done('(connection closed without a reply)'));
  });
}
