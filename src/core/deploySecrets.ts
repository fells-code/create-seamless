import { generateSecret } from "./secrets.js";
import { generateJWKS } from "./jwks.js";

export interface DeploySecretBundle {
  apiServiceToken: string;
  cookieSigningKey: string;
  bootstrapSecret: string;
  authDbPassword: string;
  apiDbPassword: string;
  authDbUser: string;
  apiDbUser: string;
  authDbName: string;
  apiDbName: string;
  jwks: {
    kid: string;
    privateKey: string;
    publicKey: string;
    publicJwksJson: string;
  };
}

export function buildDeploySecretBundle(): DeploySecretBundle {
  const kid = "main";
  const { publicKey, privateKey } = generateJWKS();

  return {
    apiServiceToken: generateSecret(32),
    cookieSigningKey: generateSecret(32),
    bootstrapSecret: generateSecret(32),
    authDbPassword: generateSecret(24),
    apiDbPassword: generateSecret(24),
    authDbUser: "auth_user",
    apiDbUser: "api_user",
    authDbName: "seamless_auth",
    apiDbName: "seamless_api",
    jwks: {
      kid,
      privateKey,
      publicKey,
      publicJwksJson: JSON.stringify(
        {
          keys: [
            {
              kid,
              pem: publicKey,
            },
          ],
        },
        null,
        2,
      ),
    },
  };
}
