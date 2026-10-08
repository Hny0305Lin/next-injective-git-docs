// rehype-external-links is an ES module; its CJS interop wrapper exposes the
// plugin function under `.default`. Resolve to the plain function so the
// Docusaurus plugin-config validator sees `[pluginFn, options]`.
const rehypeExternalLinksModule = require('rehype-external-links');
const rehypeExternalLinks =
  rehypeExternalLinksModule.default ?? rehypeExternalLinksModule;
const unwrapInvalidLinks = require('./remark/unwrap-invalid-links');
const rewriteRepoRelativeLinks = require('./remark/rewrite-repo-relative-links');
const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

const repoUrl = 'https://github.com/Hny0305Lin/next-injective-git';

// Production site URL (user-confirmed 2026-10-09). Keep in sync with the
// Vercel deployment + Cloudflare DNS record (see docs-site/DEPLOYMENT.md).
const siteUrl = 'https://docs.igit.xyz';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Next Injective Git',
  tagline: 'Git hosting on Injective — immutable EVM control plane, bring-your-own-storage data plane',
  url: siteUrl,
  baseUrl: '/',
  favicon: 'img/favicon.png',

  // en is the single source of truth; zh is served under /zh/ via Docusaurus i18n.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    localeConfigs: {
      zh: {
        label: '简体中文',
        htmlLang: 'zh-CN',
      },
    },
  },

  onBrokenLinks: 'throw',
  // Existing docs were not authored as MDX; parse all .md as plain Markdown
  // so stray `<`/`{` characters in evidence-bearing files cannot break the
  // build (front matter `format` can still opt specific files into MDX).
  // They also reference files outside docs/ (../evidence, ../cli, …) that do
  // not exist as site pages; warn instead of failing the build.
  markdown: {
    format: 'md',
    hooks: { onBrokenMarkdownLinks: 'warn' },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      {
        docs: {
          // Mount the repository's real docs folder; never move/rename its files.
          path: '../docs',
          routeBasePath: 'docs',
          sidebarPath: require.resolve('./sidebars.js'),
          // Chinese long-form docs are served through the zh locale instead
          // (en pages are the source of truth). AGENTS.md is agent guidance,
          // not site content.
          exclude: ['**/*-zh.md', 'AGENTS.md'],
          // 1) Rewrite repo-relative links the site cannot serve
          //    (../evidence, ../contracts, excluded -zh docs, …) to GitHub
          //    permalinks / zh-locale routes, without editing source files.
          // 2) Sanitize unparseable autolinks (bare URLs swallowed by GFM
          //    autolink literal, e.g. `http://x。中文`) BEFORE Docusaurus'
          //    own link transformer parses every link URL and throws.
          beforeDefaultRemarkPlugins: [
            [rewriteRepoRelativeLinks, { siteUrl }],
            unwrapInvalidLinks,
          ],
          // Open external links (e.g. provider product pages) in a new tab.
          rehypePlugins: [
            [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
          ],
        },
        blog: false,
        theme: { customCss: require.resolve('./src/css/custom.css') },
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    {
      image: 'img/igit-image.png',
      navbar: {
        title: 'Next Injective Git',
        logo: {
          alt: 'Next Injective Git logo',
          src: 'img/igit-image.png',
        },
        items: [
          { type: 'doc', docId: 'README', label: 'Docs', position: 'left' },
          { label: 'ADR', to: '/docs/adr', position: 'left' },
          { type: 'doc', docId: 'project-status', label: 'Status', position: 'left' },
          { type: 'doc', docId: 'roadmap-byos-providers', label: 'Roadmap', position: 'left' },
          { type: 'localeDropdown', position: 'right' },
          { href: repoUrl, label: 'GitHub', position: 'right' },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Documentation index', to: '/docs' },
              { label: 'Project status', to: '/docs/project-status' },
              { label: 'BYOS provider roadmap', to: '/docs/roadmap-byos-providers' },
            ],
          },
          {
            title: 'Project',
            items: [
              { label: 'GitHub', href: repoUrl },
              { label: 'ADRs', to: '/docs/adr' },
              { label: 'Glossary', to: '/docs/glossary' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Next Injective Git contributors. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    },
};

module.exports = config;
