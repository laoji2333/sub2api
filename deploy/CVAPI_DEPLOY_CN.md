# CVAPI 生产部署与更新

本文用于从 `laoji2333/sub2api` 部署 CVAPI 自定义版本。应用镜像由
GitHub Actions 构建并发布到：

```text
ghcr.io/laoji2333/sub2api
```

生产环境使用不可变的 `sha-*` 标签，不使用会移动的 `main` 标签。基础服务仍由
`docker-compose.local.yml` 管理，`docker-compose.prod.yml` 只覆盖 Sub2API 应用镜像，
不会改变 PostgreSQL、Redis、数据目录或端口配置。

当前镜像工作流只构建 `linux/amd64`。部署前执行 `uname -m`，预期结果为
`x86_64`；ARM 服务器需要先扩展镜像工作流。

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

下面的命令在服务器内部生成随机密钥，不会把密钥打印到终端。管理员初始密码仅写入
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

  umask 077
  cp .env.example .env

  pg_password="$(openssl rand -hex 32)"
  redis_password="$(openssl rand -hex 32)"
  admin_password="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 32)"
  totp_key="$(openssl rand -hex 32)"
  image_tag="sha-$(git -C /opt/sub2api rev-parse --short=7 HEAD)"

  sed -i \
    -e 's|^BIND_HOST=.*|BIND_HOST=127.0.0.1|' \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pg_password}|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${redis_password}|" \
    -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${admin_email}|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin_password}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" \
    -e "s|^TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=${totp_key}|" \
    .env

  printf '\nSUB2API_IMAGE_TAG=%s\n' "$image_tag" >> .env

  cat > /root/sub2api-initial-admin.txt <<EOF
ADMIN_EMAIL=${admin_email}
ADMIN_PASSWORD=${admin_password}
EOF

  chmod 600 .env /root/sub2api-initial-admin.txt
  mkdir -p data postgres_data redis_data backups
  chmod 700 backups

  unset pg_password redis_password admin_password jwt_secret totp_key

  docker compose \
    -f docker-compose.local.yml \
    -f docker-compose.prod.yml \
    config --quiet

  echo "CONFIG_OK image=${image_tag}"
)
```

首次登录并修改管理员密码后，将初始密码保存到密码管理器，并删除
`/root/sub2api-initial-admin.txt`。

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
```

三个容器都应显示 `healthy`。公网 HTTPS 继续由 Caddy 或其他反向代理转发到
`127.0.0.1:8080`；不要向公网开放 `8080`、`5432` 或 `6379`。

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

```bash
(
  set -eu
  cd /opt/sub2api/deploy

  mkdir -p backups
  chmod 700 backups

  stamp="$(date +%Y%m%d-%H%M%S)"
  backup_file="backups/sub2api-before-${stamp}.dump"
  temp_file="${backup_file}.tmp"

  trap 'rm -f "$temp_file"' EXIT

  docker compose \
    -f docker-compose.local.yml \
    -f docker-compose.prod.yml \
    exec -T postgres \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$temp_file"

  test -s "$temp_file"

  docker compose \
    -f docker-compose.local.yml \
    -f docker-compose.prod.yml \
    exec -T postgres pg_restore -l < "$temp_file" >/dev/null

  mv "$temp_file" "$backup_file"
  chmod 600 "$backup_file"
  trap - EXIT

  echo "BACKUP_OK=${backup_file}"
  ls -lh "$backup_file"
)
```

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

`--no-deps` 保证更新时不重启 PostgreSQL 和 Redis。

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
