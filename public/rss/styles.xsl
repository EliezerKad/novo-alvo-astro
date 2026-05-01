<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="pt-BR">
      <head>
        <title>Novo Alvo RSS</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          body{font-family:Inter,Arial,sans-serif;margin:0;background:#fafafa;color:#18181b}
          main{max-width:760px;margin:0 auto;padding:48px 20px}
          h1{font-family:Georgia,serif;font-size:42px;letter-spacing:-.04em}
          article{border-top:1px solid #e4e4e7;padding:24px 0}
          a{color:#dc2626;text-decoration:none;font-weight:900}
          p{line-height:1.7;color:#52525b}
        </style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p><xsl:value-of select="/rss/channel/description"/></p>
          <xsl:for-each select="/rss/channel/item">
            <article>
              <a href="{link}"><xsl:value-of select="title"/></a>
              <p><xsl:value-of select="description"/></p>
            </article>
          </xsl:for-each>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
