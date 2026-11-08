FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql && a2enmod rewrite
COPY backend/ /var/www/html/
RUN printf '<VirtualHost *:80>\n    DocumentRoot /var/www/html/public\n    <Directory /var/www/html/public>\n        AllowOverride All\n        Require all granted\n    </Directory>\n</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf
RUN mkdir -p /var/www/html/runtime /var/www/html/storage/wound_photos && chmod -R 777 /var/www/html/runtime /var/www/html/storage
EXPOSE 80
