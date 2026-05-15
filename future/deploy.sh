#!/bin/bash
set -e

APP_DIR="/opt/kotoba"

cd "$APP_DIR"

case "${1:-update}" in
  init)
    echo "=== Kotoba first-time deployment ==="

    # clone
    if [ ! -d "$APP_DIR" ]; then
      git clone https://github.com/FileXego/kotoba.git "$APP_DIR"
      cd "$APP_DIR"
    fi

    # .env
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "⚠️  Edit $APP_DIR/.env with your COOKIE_SECRET and TURNSTILE_SECRET"
      echo "   Then re-run: $0 init"
      exit 0
    fi

    # install
    bun install
    cd client && bun install && bun run build && cd ..

    # migrate
    bun run db:migrate

    # systemd
    sudo cp future/kotoba.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable kotoba
    sudo systemctl start kotoba

    # nginx
    sudo cp future/nginx.conf /etc/nginx/sites-available/kotoba
    sudo sed -i "s/YOUR_DOMAIN/$(hostname)/g" /etc/nginx/sites-available/kotoba
    sudo ln -sf /etc/nginx/sites-available/kotoba /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx

    # backup cron
    (crontab -l 2>/dev/null; echo "0 3 * * * $APP_DIR/future/backup.sh") | crontab -

    echo "=== Done! ==="
    echo "Edit nginx domain: sudo nano /etc/nginx/sites-available/kotoba"
    echo "HTTPS: sudo certbot --nginx"
    ;;

  update)
    echo "=== Kotoba update ==="
    git pull
    cd client && bun install && bun run build && cd ..
    sudo systemctl restart kotoba
    echo "=== Updated ==="
    ;;

  *)
    echo "Usage: $0 {init|update}"
    ;;
esac
