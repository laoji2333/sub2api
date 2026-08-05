# CVAPI 生产部署与更新

本文用于从 `laoji2333/sub2api` 部署 CVAPI 自定义版本。应用镜像由
GitHub Actions 构建并发布到：

```text
ghcr.io/laoji2333/sub2api
```

生产环境使用不可变的 `sha-*` 标签，不使用会移动的 `main` 标签。
目标架构为：

- PostgreSQL：Railway 公网 TCP Proxy，强制 SSL；
- Redis：外部 TCP 服务，当前明确使用明文连接；
- 应用：`ghcr.io/laoji2333/sub2api` 的不可变镜像；
- 本地 PostgreSQL 和 Redis：保留服务定义和数据，但默认不启动。

`docker-compose.prod.yml` 要放在 `docker-compose.yml` 或 `docker-compose.local.yml`
之后合并；它同时覆盖应用镜像、PostgreSQL/Redis 连接和启动依赖。

本文示例使用 `docker-compose.local.yml`。如果现有服务器使用命名卷版
`docker-compose.yml`，将命令中的第一个 Compose 文件替换为它即可。

当前镜像工作流只构建 `linux/amd64`。部署前执行 `uname -m`，预期结果为
`x86_64`；ARM 服务器需要先扩展镜像工作流。

`docker-compose.prod.yml` 使用 Compose 官方的 `!override` 标签移除应用对本地
PostgreSQL、Redis 健康检查的依赖，因此需要 Docker Compose 2.24.4 或更高版本：

```bash
docker compose version
```

在 Railway PostgreSQL 服务中启用 Public Networking，使用它提供的 TCP Proxy
主机和端口。不要把 `DATABASE_PUBLIC_URL`、密码或 `.env` 提交到 Git。

外部 Redis 必须启用密码认证，并在服务器防火墙或服务商访问控制中只允许新应用
服务器的固定公网 IP 连接。当前方案使用普通 TCP，Redis 密码、命令和数据不会加密；
不得把 Redis 端口对 `0.0.0.0/0` 或整个公网开放。

## 一、新服务器首次部署

### 1. 确认镜像构建成功

代码推送到 `main` 后，先在 GitHub Actions 中确认 `Build deployment image` 成功。
对应镜像标签为当前提交短 SHA，例如提交 `abcdef123...` 对应：

```text
sha-abcdef1
```

### 2. 克隆自己的仓库

```bash
git clone https://github.com/laoji2333/sub2api.git /opt/sub2api
cd /opt/sub2api/deploy
```

### 3. 创建生产配置

下面的命令会交互式读取 Railway PostgreSQL 和外部 Redis 的拆分连接字段，
数据库及 Redis 密码输入时不显示；同时在服务器内部生成本地 PostgreSQL、JWT、
TOTP 和管理员密钥。管理员初始密码仅写入
`/root/sub2api-initial-admin.txt`，不要把该文件内容发送到聊天、日志或代码仓库。

```bash
(
  set -eu
  cd /opt/sub2api/deploy

  if [ -e .env ]; then
    echo ".env already exists; no changes applied"
    exit 1
  fi

  read -r -p "Admin email: " admin_email
  test -n "$admin_email"
  printf '%s\n' "$admin_email" | grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'

  read -r -p "Railway DATABASE_HOST: " database_host
  read -r -p "Railway DATABASE_PORT: " database_port
  read -r -p "Railway DATABASE_USER: " database_user
  read -r -p "Railway DATABASE_DBNAME: " database_name
  read -r -s -p "Railway DATABASE_PASSWORD: " database_password
  printf '\n'

  read -r -p "External REDIS_HOST: " redis_host
  read -r -p "External REDIS_PORT: " redis_port
  read -r -p "External REDIS_USERNAME (empty for default user): " redis_username
  read -r -s -p "External REDIS_PASSWORD: " redis_password
  printf '\n'

  test -n "$database_host"
  test -n "$database_port"
  test -n "$database_user"
  test -n "$database_name"
  test -n "$database_password"
  test -n "$redis_host"
  test -n "$redis_port"
  test -n "$redis_password"

  umask 077
  grep -vE '^(DATABASE_HOST|DATABASE_PORT|DATABASE_USER|DATABASE_PASSWORD|DATABASE_DBNAME|DATABASE_SSLMODE|REDIS_HOST|REDIS_PORT|REDIS_USERNAME|REDIS_PASSWORD|REDIS_DB|REDIS_ENABLE_TLS|SUB2API_IMAGE_TAG)=' \
    .env.example > .env

  local_pg_password="$(openssl rand -hex 32)"
  admin_password="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 32)"
  totp_key="$(openssl rand -hex 32)"
  image_tag="sha-$(git -C /opt/sub2api rev-parse --short=7 HEAD)"

  sed -i \
    -e 's|^BIND_HOST=.*|BIND_HOST=127.0.0.1|' \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${local_pg_password}|" \
    -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${admin_email}|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin_password}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" \
    -e "s|^TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=${totp_key}|" \
    .env

  printf '\nDATABASE_HOST=%s\n' "$database_host" >> .env
  printf 'DATABASE_USER=%s\n' "$database_user" >> .env
  printf 'DATABASE_PASSWORD=%s\n' "$database_password" >> .env
  printf 'DATABASE_DBNAME=%s\n' "$database_name" >> .env
  printf 'DATABASE_SSLMODE=require\n' >> .env
  printf 'REDIS_HOST=%s\n' "$redis_host" >> .env
  printf 'REDIS_PORT=%s\n' "$redis_port" >> .env
  printf 'REDIS_USERNAME=%s\n' "$redis_username" >> .env
  printf 'REDIS_PASSWORD=%s\n' "$redis_password" >> .env
  printf 'REDIS_DB=0\n' >> .env
  printf 'REDIS_ENABLE_TLS=false\n' >> .env
  printf 'SUB2API_IMAGE_TAG=%s\n' "$image_tag" >> .env

  cat > /root/sub2api-initial-admin.txt <<EOF
ADMIN_EMAIL=${admin_email}
ADMIN_PASSWORD=${admin_password}
EOF

  chmod 600 .env /root/sub2api-initial-admin.txt
  mkdir -p data postgres_data redis_data backups
  chmod 700 backups

  unset database_password local_pg_password redis_password admin_password jwt_secret totp_key

  docker compose \
    -f docker-compose.local.yml \
    -f docker-compose.prod.yml \
    config --quiet

  echo "CONFIG_OK image=${image_tag}"
)
```

首次登录并修改管理员密码后，将初始密码保存到密码管理器，并删除
`/root/sub2api-initial-admin.txt`。

`POSTGRES_PASSWORD` 仅用于保留的本地 PostgreSQL 定义；生产应用实际使用
`DATABASE_*` 连接 Railway，并使用 `REDIS_*` 连接外部 Redis。实际值只保留在权限为
`600` 的 `.env` 和加密备份中。

### 4. 启动服务

```bash
cd /opt/sub2api/deploy

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  pull

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  up -d --wait --wait-timeout 180

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  ps

curl -fsS http://127.0.0.1:8080/health
echo

docker inspect sub2api \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(DATABASE_HOST|DATABASE_PORT|DATABASE_USER|DATABASE_DBNAME|DATABASE_SSLMODE|REDIS_HOST|REDIS_PORT|REDIS_USERNAME|REDIS_DB|REDIS_ENABLE_TLS)='
```

只有 `sub2api` 应默认启动并显示 `healthy`，本地 `postgres`、`redis` 不应启动。
连接信息应显示：

- `DATABASE_HOST` 为 Railway TCP Proxy 主机；
- `DATABASE_PORT` 为 Railway TCP Proxy 端口；
- `DATABASE_SSLMODE=require`；
- `REDIS_HOST` 和 `REDIS_PORT` 为外部 Redis TCP 地址；
- `REDIS_ENABLE_TLS=false`。

上面的检查不会输出数据库或 Redis 密码。公网 HTTPS 继续由 Caddy 或其他反向代理
转发到 `127.0.0.1:8080`；不要向公网开放应用的 `8080`。外部 Redis 端口只允许
应用服务器的固定公网 IP 访问。

## 二、发布新版本

先在本地完成测试并推送代码，等待 GitHub Actions 的 `Build deployment image` 成功，
再操作生产服务器。

### 1. 拉取代码并生成目标标签

```bash
cd /opt/sub2api
git fetch origin main
git merge --ff-only origin/main

cd deploy
new_tag="sha-$(git -C /opt/sub2api rev-parse --short=7 HEAD)"
echo "TARGET_IMAGE_TAG=${new_tag}"
```

确认输出的标签与 GitHub Packages 中成功构建的标签一致后再继续。

### 2. 备份 PostgreSQL

#### 网站管理界面手动备份

### 3. 固定新镜像标签

```bash
(
  set -eu
  cd /opt/sub2api/deploy

  new_tag="sha-$(git -C /opt/sub2api rev-parse --short=7 HEAD)"

  if grep -q '^SUB2API_IMAGE_TAG=' .env; then
    sed -i "s|^SUB2API_IMAGE_TAG=.*|SUB2API_IMAGE_TAG=${new_tag}|" .env
  else
    printf '\nSUB2API_IMAGE_TAG=%s\n' "$new_tag" >> .env
  fi

  docker compose \
    -f docker-compose.local.yml \
    -f docker-compose.prod.yml \
    config --quiet

  echo "IMAGE_TAG_UPDATED=${new_tag}"
)
```

### 4. 只替换应用容器

```bash
cd /opt/sub2api/deploy

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  pull sub2api

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  up -d --no-deps --wait --wait-timeout 180 sub2api

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  ps

docker inspect \
  --format 'image={{.Config.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}' \
  sub2api

curl -fsS http://127.0.0.1:8080/health
```

`--no-deps` 保证只替换应用容器。Railway PostgreSQL 和外部 Redis 都不由 Compose 重启。

## 三、应用镜像回滚

将 `.env` 中的 `SUB2API_IMAGE_TAG` 改回上一个已验证的 `sha-*` 标签，然后重复“拉取镜像”和
“只替换应用容器”两步。

数据库迁移是单向的。镜像回滚不能撤销数据库结构变化；如果新版本包含不兼容迁移，必须结合升级前的
PostgreSQL 备份制定恢复方案。

不要执行：

```bash
docker compose down -v
```

`-v` 会删除 Docker 卷。也不要删除尚未完成验证的数据库备份和上一版本镜像。

## 四、本地数据服务与恢复边界

`docker-compose.prod.yml` 为 `postgres` 和 `redis` 分别设置了 `local-postgres`、
`local-redis` profile。本地服务定义及数据仍保留，但普通的 `up -d` 不会启动它们。
只在明确的恢复或取证操作中启动：

```bash
docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  --profile local-postgres \
  up -d postgres
```

```bash
docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  --profile local-redis \
  up -d redis
```

这不是自动故障转移。本地服务中的数据可能落后于外部数据服务，不得在未核对数据和
连接参数时直接将生产应用指回它们。不要删除尚未验证的数据目录或数据卷。
