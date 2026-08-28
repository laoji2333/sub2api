# CVAPI 生产部署与更新

本文用于从 `laoji2333/sub2api` 部署 CVAPI 自定义版本。应用镜像由 GitHub Actions
构建并发布到：

```text
ghcr.io/laoji2333/sub2api
```

生产环境使用不可变的 `sha-*` 标签，不使用会移动的 `main` 标签。当前单服务器架构为：

- 应用：`ghcr.io/laoji2333/sub2api` 的不可变镜像；
- PostgreSQL：同一台服务器上的 `postgres:18.6-alpine`，数据保存在本地目录或命名卷；
- Redis：同一台服务器上的 `redis:8-alpine`，同时启用 RDB 和 AOF；
- 公网入口：Caddy 或其他反向代理转发到 `127.0.0.1:8080`；
- PostgreSQL 和 Redis 只加入 Compose 私有网络，不映射宿主机公网端口。

`docker-compose.prod.yml` 必须放在 `docker-compose.yml` 或
`docker-compose.local.yml` 之后合并。基础文件负责本地 PostgreSQL/Redis、健康检查、
启动依赖和数据持久化；生产覆盖文件只选择不可变的自定义应用镜像。

本文示例使用便于迁移和备份的 `docker-compose.local.yml`。如果现有服务器使用命名卷版
`docker-compose.yml`，将命令中的第一个 Compose 文件替换为它即可。

当前镜像工作流只构建 `linux/amd64`。部署前执行 `uname -m`，预期结果为 `x86_64`；
ARM 服务器需要先扩展镜像工作流。

## 一、新服务器首次部署

### 1. 确认镜像构建成功

代码推送到 `main` 后，先在 GitHub Actions 中确认 `Build deployment image` 成功。
当前提交 `abcdef123...` 对应镜像标签：

```text
sha-abcdef1
```

### 2. 克隆仓库

```bash
git clone https://github.com/laoji2333/sub2api.git /opt/sub2api
cd /opt/sub2api/deploy
```

### 3. 创建生产配置

真实密码和密钥只写入权限为 `600` 的 `.env`，不得提交到 Git、文档、日志或聊天。
下面的初始化命令生成本地 PostgreSQL、Redis、JWT、TOTP 和管理员密码；管理员初始密码
仅写入 `/root/sub2api-initial-admin.txt`。

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
  printf '%s\n' "$admin_email" |
    grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'

  umask 077
  grep -v '^SUB2API_IMAGE_TAG=' .env.example > .env

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

应用通过 Compose 服务名连接数据服务：

- `DATABASE_HOST=postgres`、`DATABASE_PORT=5432`、`DATABASE_SSLMODE=disable`；
- `REDIS_HOST=redis`、`REDIS_PORT=6379`、`REDIS_ENABLE_TLS=false`；
- 数据库账号和密码来自 `POSTGRES_*`；Redis 密码来自 `REDIS_PASSWORD`。

#### 配置来源与优先级

Docker 部署同时保留 `.env`、容器环境变量和 `data/config.yaml`：

1. Compose 先用 shell 环境或 `.env` 解析 `${...}` 占位符；
2. `docker-compose.local.yml` 将解析结果和固定的 `postgres`/`redis` 地址注入应用容器；
3. 应用运行时，容器环境变量覆盖 `data/config.yaml` 中的同名字段；
4. 两者都没有时才使用程序默认值。

`AUTO_SETUP=true` 不会在每次启动时重写 YAML；只要 `config.yaml` 或 `.installed`
已存在，就会跳过初始安装。因此完成外部数据服务迁移后，必须同时清理
`.env` 的旧连接字段，并将 `data/config.yaml` 的 `database`/`redis` 段同步为
本地值。当前容器已经使用本地连接时，清理磁盘文件不需要立即重启；
下次发布或维护窗口重建应用容器时会读取新配置。

### 4. 启动并验证全部服务

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
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  grep -E '^(DATABASE_HOST|DATABASE_PORT|DATABASE_USER|DATABASE_DBNAME|DATABASE_SSLMODE|REDIS_HOST|REDIS_PORT|REDIS_USERNAME|REDIS_DB|REDIS_ENABLE_TLS)='

docker exec sub2api-postgres postgres --version
docker exec sub2api-redis redis-cli --raw PING
```

成功标准：

- `sub2api`、`sub2api-postgres`、`sub2api-redis` 都为 `healthy`；
- 应用显示 `DATABASE_HOST=postgres`、`DATABASE_SSLMODE=disable`、`REDIS_HOST=redis`；
- PostgreSQL 版本为 18.6；Redis 返回 `PONG`；
- PostgreSQL 和 Redis 没有宿主机端口映射；
- 公网 HTTPS 由 Caddy 等反向代理转发到 `127.0.0.1:8080`，不直接开放 8080。

## 二、发布新版本

先在本地完成测试并推送代码，等待 GitHub Actions 的 `Build deployment image` 成功，
再操作生产服务器。服务器工作树必须干净；如有部署配置改动，先同步回仓库，不要直接
用 `git pull` 覆盖生产差异。

### 1. 拉取代码并确认目标标签

```bash
cd /opt/sub2api
git status --short
git fetch origin main
git merge --ff-only origin/main

cd deploy
new_tag="sha-$(git -C /opt/sub2api rev-parse --short=7 HEAD)"
echo "TARGET_IMAGE_TAG=${new_tag}"
```

确认标签与 GitHub Packages 中成功构建的镜像一致后再继续。

### 2. 备份数据和配置

在管理后台手动创建一次 PostgreSQL 备份并确认 R2 上传成功。发布前还必须单独保存：

- `.env`、`data/config.yaml`；
- `docker-compose.local.yml`、`docker-compose.prod.yml`；
- `redis_data` 或停写后生成的 Redis RDB；
- Caddy 配置及证书数据；
- 当前应用镜像标签。

应用内的 R2 数据库备份只包含单个 PostgreSQL 数据库，不包含 Redis、`.env`、
`data/config.yaml`、Compose 文件或 Caddy 配置。

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

docker inspect sub2api \
  --format 'image={{.Config.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}'

curl -fsS http://127.0.0.1:8080/health
```

`--no-deps` 保证发布应用镜像时不重启本地 PostgreSQL 和 Redis。数据库迁移仍可能由新应用
在启动时执行，因此发布前必须保留可恢复的 PostgreSQL 备份。

## 三、回滚边界

应用镜像回滚：将 `.env` 中的 `SUB2API_IMAGE_TAG` 改回上一个已验证的 `sha-*` 标签，
然后重复“拉取应用镜像”和“只替换应用容器”。

数据库迁移是单向的。镜像回滚不能撤销数据库结构变化；如果新版本包含不兼容迁移，必须
结合升级前 PostgreSQL 备份制定恢复方案。

不要执行：

```bash
docker compose down -v
```

`-v` 会删除命名卷。使用本地目录版时，也不要删除 `postgres_data`、`redis_data` 或
`data`。不要在验证完成前清理旧镜像、逻辑备份、Redis 快照或配置备份。

## 四、从外部 PostgreSQL/Redis 迁回本机

生产迁移必须安排维护窗口，推荐顺序：

1. 核对源 PostgreSQL 版本、数据库大小、Redis 内存、键数量和持久化状态；
2. 在不停机状态下完成一次预备份及隔离恢复演练；
3. 发布维护公告并停止应用，冻结所有业务写入；
4. 创建并校验最终 PostgreSQL custom-format dump 和 Redis RDB；
5. 恢复最终 PostgreSQL，并逐表比对源库与目标库的精确行数；
6. Redis 首次导入 RDB 时先关闭 AOF，确认键数后再启用 AOF 并等待重写完成；
7. 让 `docker-compose.prod.yml` 只保留应用镜像覆盖，由基础 Compose 恢复本地连接和
   `service_healthy` 依赖；
8. 删除 `.env` 中旧的 `DATABASE_HOST/PORT/USER/PASSWORD/DBNAME/SSLMODE` 和
   `REDIS_HOST/PORT`，保留本地 `POSTGRES_*`、`REDIS_PASSWORD`、`REDIS_DB=0` 和
   `REDIS_ENABLE_TLS=false`，并同步 `data/config.yaml`；
9. 启动应用，验证公网健康检查、后台登录、真实 API 请求、计费写入、容器重启次数和日志；
10. 暂时保留外部源服务和最终备份，但不要继续向旧源写入。

Redis 在启用 AOF 时会优先加载 AOF。不要把 RDB 直接放入一个已经生成空 AOF 的目录，
否则容器虽然健康，数据库仍可能是空的。正确做法是用干净目录先以 `appendonly no` 加载
RDB，再启用 AOF、等待重写成功，最后由正式 Compose 容器重新加载。

应用切换到本地数据服务后，外部源库会立即变成落后副本。此后不能只修改连接地址直接回退；
若需要回到外部服务，必须先处理切换后产生的新写入。

## 五、备份与容量检查

单服务器架构降低了网络延迟和外部数据服务费用，但应用、PostgreSQL、Redis 和磁盘位于
同一故障域。至少保留：

- 每日 PostgreSQL 逻辑备份到另一提供商或对象存储；
- 定期 Redis RDB/AOF 与 `redis_data` 备份；
- `.env`、固定 `TOTP_ENCRYPTION_KEY`、`data/config.yaml`、Compose 和 Caddy 配置的加密备份；
- 定期恢复演练，而不只是确认备份上传成功；
- 宿主机或云平台快照作为额外回滚层，但不能替代数据库逻辑备份。

### 配置加密备份

配置恢复包包含 `.env`、`data` 中的恢复必需文件、实际使用的 Compose
文件、Caddyfile 和 Caddy 证书数据。排除运行日志和含旧密码的
`config.yaml.bak-*`。下面的管道直接将 tar/gzip 输出交给 GPG，不会在磁盘上
生成明文 `.tar.gz`：

```bash
(
  set -Eeuo pipefail
  cd /opt/sub2api/deploy

  archive="/root/sub2api-recovery-$(date +%Y%m%d-%H%M%S).tar.gz.gpg"
  umask 077
  trap 'rm -f -- "$archive"' ERR

  test -f .env
  test -f data/config.yaml
  test -f data/.installed
  test -f docker-compose.local.yml
  test -f docker-compose.prod.yml
  test -f /etc/caddy/Caddyfile
  test -d /var/lib/caddy

  tar --acls --xattrs --numeric-owner \
    --exclude='opt/sub2api/deploy/data/logs' \
    --exclude='opt/sub2api/deploy/data/config.yaml.bak-*' \
    -C / -czf - \
    opt/sub2api/deploy/.env \
    opt/sub2api/deploy/data \
    opt/sub2api/deploy/docker-compose.local.yml \
    opt/sub2api/deploy/docker-compose.prod.yml \
    etc/caddy/Caddyfile \
    var/lib/caddy |
  gpg --symmetric --cipher-algo AES256 --pinentry-mode loopback --output "$archive"

  chmod 600 "$archive"
  trap - ERR
  echo "encrypted_archive=$archive"
)
```

必须使用同一密码做一次不落地明文的解密和 tar 完整性校验：

```bash
archive="$(ls -1t /root/sub2api-recovery-*.tar.gz.gpg | head -n1)"
gpg --decrypt --pinentry-mode loopback "$archive" |
  tar -tzf - >/dev/null &&
  echo "encrypted_archive_validation=ok"

archive_dir="$(dirname "$archive")"
archive_name="$(basename "$archive")"
(cd "$archive_dir" && sha256sum "$archive_name" > "${archive_name}.sha256")
chmod 600 "${archive}.sha256"
```

下载 GPG 文件和 SHA256 文件到另一台设备。SHA256 只用于确认传输后的
文件与服务器原件一致，不是解密密钥。GPG 密码必须与备份分开保存。

在新服务器上先解压到隔离目录，不要直接覆盖现有生产文件：

```bash
archive="/root/sub2api-recovery-YYYYMMDD-HHMMSS.tar.gz.gpg"
restore_dir="/root/sub2api-config-restore"

(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")

test ! -e "$restore_dir"
install -d -m 700 "$restore_dir"

gpg --decrypt --pinentry-mode loopback "$archive" |
  tar --acls --xattrs --numeric-owner -xzf - -C "$restore_dir"

test -f "$restore_dir/opt/sub2api/deploy/.env" &&
  test -f "$restore_dir/opt/sub2api/deploy/data/config.yaml" &&
  echo "decrypt_and_extract=ok"
```

在新服务器安装好 Docker 和 Caddy 后，将隔离目录中的配置放到正式路径。
下面的命令只校验 Compose，不启动应用：

```bash
(
  set -Eeuo pipefail
  src="/root/sub2api-config-restore"

  install -d -m 755 /opt/sub2api/deploy /etc/caddy /var/lib/caddy
  cp -a "$src/opt/sub2api/deploy/." /opt/sub2api/deploy/
  cp -a "$src/etc/caddy/Caddyfile" /etc/caddy/Caddyfile
  cp -a "$src/var/lib/caddy/." /var/lib/caddy/

  chown root:root /opt/sub2api/deploy/.env /etc/caddy/Caddyfile
  chmod 600 /opt/sub2api/deploy/.env /opt/sub2api/deploy/data/config.yaml
  chmod 400 /opt/sub2api/deploy/data/.installed
  chmod 644 /etc/caddy/Caddyfile

  if id caddy >/dev/null 2>&1; then
    chown -R caddy:caddy /var/lib/caddy
  fi

  cd /opt/sub2api/deploy
  docker compose -f docker-compose.local.yml -f docker-compose.prod.yml config --quiet
  echo "configuration_restore=ok"
)
```

这个加密包不包含 PostgreSQL 或 Redis 的最新数据。恢复新服务器时，必须先
完成数据恢复和连接校验，再启动应用容器。

迁移演练曾在 4 GB 内存、60 GB 磁盘服务器上验证约 674 MB PostgreSQL 和数 MB Redis；
应用、PostgreSQL、Redis 三个容器的稳定内存占用远低于 1 GB。这只是当时数据规模的结果，
不是固定容量承诺。持续观察 CPU、可用内存、Swap、磁盘、PostgreSQL 连接数、Redis 内存、
QPS 和 P95/P99 延迟，数据增长后重新评估。

常用检查：

```bash
docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  ps

docker stats --no-stream sub2api sub2api-postgres sub2api-redis
df -h /opt/sub2api/deploy
```

## 六、在全新服务器恢复生产环境

本节用于原服务器不可用时，在一台全新的 Ubuntu 22.04/24.04/26.04 `x86_64`
服务器上恢复 CVAPI。
恢复材料只有：

- 配置恢复包 `sub2api-recovery-*.tar.gz.gpg`，以及它的 GPG 密码；
- 最好同时具有对应的 `.sha256` 文件；
- 从 R2 下载的单文件 PostgreSQL 备份 `sub2api_YYYYMMDD_HHMMSS.sql.gz`。

R2 文件是本项目生成的单数据库逻辑备份，格式为 `pg_dump -> gzip`，不是
`pg_restore` 使用的 custom-format 归档。下列流程故意不恢复 Redis：新服务器上的
Redis 从空库启动，原登录会话、缓存、限流状态和未完成的临时任务可能丢失，用户可能需要
重新登录。PostgreSQL 恢复完成前不要启动 `sub2api` 应用容器。

如果 R2 中只有 `payload.part-*` 分卷，不要把任意一个分卷当成 `.sql.gz` 执行；本节只适用于
已经下载为一个完整 `.sql.gz` 文件的备份。

### 1. 检查服务器和上传恢复文件

先以 `root` 登录新服务器。当前生产镜像只构建 `linux/amd64`，因此必须看到
`x86_64`。同时确认磁盘和内存满足当前数据规模：

```bash
uname -m
cat /etc/os-release
free -h
df -h /
```

创建只允许 root 访问的接收目录：

```bash
install -d -m 700 /root/sub2api-recovery-input
```

先在电脑上从 R2 下载完整数据库备份，再把以下文件上传到该目录：

```text
sub2api-recovery-YYYYMMDD-HHMMSS.tar.gz.gpg
sub2api-recovery-YYYYMMDD-HHMMSS.tar.gz.gpg.sha256
sub2api_YYYYMMDD_HHMMSS.sql.gz
```

上传后在服务器检查文件存在。不要在命令行或聊天中填写 GPG 密码：

```bash
ls -lh /root/sub2api-recovery-input
chmod 600 /root/sub2api-recovery-input/*
```

### 2. 安装 Docker Engine、Compose、GPG 和 Caddy

以下命令使用 Docker 的 Ubuntu 官方软件源。全程使用 root，不需要再加 `sudo`：

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg gzip tar

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

docker version
docker compose version
```

安装 Caddy。Caddy 官方对 Ubuntu 和 Debian 共用下面这个 APT 软件源，因此 URL
中出现 `debian.deb.txt` 是正常的，并不表示宿主机被当成 Debian。软件包安装后会
自动启动默认服务，因此安装完成后先停止它，等应用和配置都验证通过再正式启动：

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl

curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
  gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt |
  tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null

chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
systemctl stop caddy
```

Docker 官方安装说明：<https://docs.docker.com/engine/install/ubuntu/>；Caddy 官方安装说明：
<https://caddyserver.com/docs/install#debian-ubuntu-raspbian>。

### 3. 校验并解密配置恢复包

将下面前两行替换成手头文件的真实文件名。路径中不包含密码：

```bash
archive="/root/sub2api-recovery-input/sub2api-recovery-YYYYMMDD-HHMMSS.tar.gz.gpg"
pg_backup="/root/sub2api-recovery-input/sub2api_YYYYMMDD_HHMMSS.sql.gz"

test -s "$archive"
test -s "$pg_backup"

if test -f "${archive}.sha256"; then
  (cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
else
  echo "gpg_sha256=skipped_no_sidecar"
fi

gzip -t "$pg_backup" && echo "postgres_backup_gzip=ok"
```

先做一次不落地明文的 GPG/tar 完整性检查。命令会交互式要求输入 GPG 密码：

```bash
archive="/root/sub2api-recovery-input/sub2api-recovery-YYYYMMDD-HHMMSS.tar.gz.gpg"

gpg --decrypt --pinentry-mode loopback "$archive" |
  tar -tzf - >/dev/null &&
  echo "encrypted_archive_validation=ok"
```

确认成功后解压到隔离目录。不要直接解压到 `/`：

```bash
(
  set -Eeuo pipefail
  archive="/root/sub2api-recovery-input/sub2api-recovery-YYYYMMDD-HHMMSS.tar.gz.gpg"
  restore_dir="/root/sub2api-config-restore"

  test ! -e "$restore_dir"
  install -d -m 700 "$restore_dir"

  gpg --decrypt --pinentry-mode loopback "$archive" |
    tar --acls --xattrs --numeric-owner -xzf - -C "$restore_dir"

  test -f "$restore_dir/opt/sub2api/deploy/.env"
  test -f "$restore_dir/opt/sub2api/deploy/data/config.yaml"
  test -f "$restore_dir/opt/sub2api/deploy/data/.installed"
  test -f "$restore_dir/opt/sub2api/deploy/docker-compose.local.yml"
  test -f "$restore_dir/opt/sub2api/deploy/docker-compose.prod.yml"
  test -f "$restore_dir/etc/caddy/Caddyfile"
  echo "decrypt_and_extract=ok"
)
```

### 4. 恢复配置并创建空数据目录

这个步骤只复制和校验配置，不启动容器：

```bash
(
  set -Eeuo pipefail
  src="/root/sub2api-config-restore"
  deploy_dir="/opt/sub2api/deploy"

  systemctl stop caddy
  install -d -m 755 "$deploy_dir" /etc/caddy /var/lib/caddy

  cp -a "$src/opt/sub2api/deploy/." "$deploy_dir/"
  cp -a "$src/etc/caddy/Caddyfile" /etc/caddy/Caddyfile
  cp -a "$src/var/lib/caddy/." /var/lib/caddy/

  install -d -m 755 \
    "$deploy_dir/postgres_data" \
    "$deploy_dir/redis_data" \
    "$deploy_dir/data/logs"
  install -d -m 700 "$deploy_dir/backups"
  install -d -o caddy -g caddy -m 0750 /var/log/caddy

  chown root:root "$deploy_dir/.env" /etc/caddy/Caddyfile
  chown -R 1000:1000 "$deploy_dir/data"
  chown -R caddy:caddy /var/lib/caddy /var/log/caddy
  chmod 600 "$deploy_dir/.env" "$deploy_dir/data/config.yaml"
  chmod 400 "$deploy_dir/data/.installed"
  chmod 644 /etc/caddy/Caddyfile

  test -z "$(find "$deploy_dir/postgres_data" -mindepth 1 -print -quit)"
  test -z "$(find "$deploy_dir/redis_data" -mindepth 1 -print -quit)"
  ! grep -Eiq 'railway|rlwy\.net' \
    "$deploy_dir/.env" "$deploy_dir/data/config.yaml"

  cd "$deploy_dir"
  docker compose \
    -f docker-compose.local.yml \
    -f docker-compose.prod.yml \
    config --quiet

  echo "configuration_restore=ok"
)
```

这里要求 `postgres_data` 和 `redis_data` 都为空。如果命令在两个 `test -z` 之一停止，
不要删除目录内容；先确认该服务器是否真的为全新服务器，以及目录里数据的来源。

### 5. 只启动 PostgreSQL 和空 Redis

先拉取并启动两个数据服务。指定服务名不会启动依赖它们的 `sub2api` 应用：

```bash
cd /opt/sub2api/deploy

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  pull postgres redis

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  up -d --wait --wait-timeout 180 postgres redis

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  ps postgres redis
```

验证 PostgreSQL 可连接且尚无业务表，同时验证 Redis 是空库。此时
`redis_keys_before_app` 必须等于 `0`：

```bash
docker exec sub2api-postgres postgres --version
docker exec sub2api-postgres pg_isready

pg_tables_before="$(docker exec sub2api-postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "SELECT count(*) FROM pg_tables WHERE schemaname=current_schema();"')"
test "$pg_tables_before" = "0"
echo "postgres_public_tables_before_restore=$pg_tables_before"

docker exec sub2api-redis redis-cli --raw PING
redis_keys_before_app="$(docker exec sub2api-redis redis-cli --raw DBSIZE)"
test "$redis_keys_before_app" = "0"
echo "redis_keys_before_app=$redis_keys_before_app"
```

### 6. 从 R2 的 `.sql.gz` 恢复 PostgreSQL

恢复命令和项目内部恢复逻辑一致：gzip 流直接交给 `psql`，并使用单事务。整个命令块
启用了 `pipefail`，解压或 SQL 任一环节失败都会返回非零状态：

```bash
(
  set -Eeuo pipefail
  pg_backup="/root/sub2api-recovery-input/sub2api_YYYYMMDD_HHMMSS.sql.gz"

  gzip -t "$pg_backup"
  gzip -cd "$pg_backup" |
    docker exec -i sub2api-postgres sh -c \
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      --single-transaction --set ON_ERROR_STOP=on'

  echo "postgres_restore=ok"
)
```

恢复后必须看到大于 `0` 的业务表数量：

```bash
pg_tables_after="$(docker exec sub2api-postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "SELECT count(*) FROM pg_tables WHERE schemaname=current_schema();"')"
test "$pg_tables_after" -gt 0
echo "postgres_public_tables_after_restore=$pg_tables_after"

docker exec sub2api-postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "SELECT pg_size_pretty(pg_database_size(current_database()));"'
```

如果恢复失败，不要启动应用，也不要用失败后可能残留的数据库继续尝试。由于本流程使用
`--single-transaction`，正常失败应整体回滚；仍需检查 PostgreSQL 日志并确认表数量为 `0`
后再重试。

### 7. 启动应用并验证本地连接

数据库恢复成功后，才拉取并启动固定 SHA 的应用镜像：

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

docker inspect sub2api \
  --format 'image={{.Config.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}'

curl -fsS http://127.0.0.1:8080/health
echo
```

检查容器实际使用本地服务名。下面的命令不会输出密码：

```bash
docker inspect sub2api \
  --format '{{range .Config.Env}}{{println .}}{{end}}' |
  grep -E '^(DATABASE_HOST|DATABASE_PORT|DATABASE_DBNAME|DATABASE_SSLMODE|REDIS_HOST|REDIS_PORT|REDIS_DB|REDIS_ENABLE_TLS)='
```

预期至少包含 `DATABASE_HOST=postgres`、`DATABASE_SSLMODE=disable`、
`REDIS_HOST=redis` 和 `REDIS_ENABLE_TLS=false`。应用启动后 Redis 可能立即生成缓存键，
因此不能再要求 `DBSIZE` 等于 `0`。

检查状态、资源和近期严重日志：

```bash
cd /opt/sub2api/deploy

docker compose \
  -f docker-compose.local.yml \
  -f docker-compose.prod.yml \
  ps

docker stats --no-stream sub2api sub2api-postgres sub2api-redis

docker logs --since 10m sub2api 2>&1 |
  grep -Ei 'panic|fatal|connection refused|authentication failed|no route to host' ||
  echo "critical_log_patterns=none"
```

### 8. 验证并启动 Caddy

先验证恢复出来的生产 Caddyfile。只有看到 `Valid configuration` 才启动服务：

```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable --now caddy
systemctl status caddy --no-pager
ss -lntp | grep -E ':(80|443|8080)[[:space:]]'
```

在 DNS 尚未切换时，可强制把正式域名解析到新服务器本机，验证 Caddy、证书和反向代理：

```bash
curl --resolve api.cvapi.vip:443:127.0.0.1 \
  -fsS https://api.cvapi.vip/health
echo
```

如果实际正式域名不是 `api.cvapi.vip`，将命令中的两个域名同时替换成 Caddyfile 中的生产域名。
该检查通过后再修改 DNS 或云平台浮动 IP。防火墙只应公开 SSH、80 和 443；PostgreSQL、
Redis 和应用 8080 都不应直接暴露公网。

### 9. 最终验收和恢复后的处理

切换流量前至少完成：

1. 三个容器均为 `healthy`，Caddy 为 `active (running)`；
2. 本机和公网 `/health` 均成功；
3. 后台登录正常，抽查用户、账号、额度和历史数据；
4. 发起一次真实 API 请求，确认响应、计费和数据库写入；
5. 确认 R2 自动备份配置仍然存在，并手动创建一次新的 PostgreSQL 备份；
6. 观察一段时间的应用、PostgreSQL、Redis 和 Caddy 日志及资源占用。

恢复完成后不要立即删除 GPG 包、R2 数据库备份或隔离目录。至少等业务验证和新一轮异地
备份成功后再清理。整个恢复过程中都不要执行：

```bash
docker compose down -v
rm -rf /opt/sub2api/deploy/postgres_data
rm -rf /opt/sub2api/deploy/redis_data
```
