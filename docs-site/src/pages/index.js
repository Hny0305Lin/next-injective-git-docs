import React from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';

import styles from './index.module.css';
import ContributorsWall from '../components/ContributorsWall';

const features = [
  {
    icon: '🛡️',
    title: (
      <Translate id="homepage.feature.controlplane.title">
        Immutable control plane
      </Translate>
    ),
    body: (
      <Translate id="homepage.feature.controlplane.body">
        Repository state lives in a non-upgradeable Injective EVM Suite. Every
        module binding and code hash is verified before reads or writes.
      </Translate>
    ),
  },
  {
    icon: '🗄️',
    title: (
      <Translate id="homepage.feature.byos.title">
        Bring-your-own storage (Suite v4)
      </Translate>
    ),
    body: (
      <Translate id="homepage.feature.byos.body">
        The v4 successor data plane packs Git objects into your own Amazon S3 or
        Cloudflare R2 bucket with full read-back verification. No IPFS node, no
        WSL2, no injectived.
      </Translate>
    ),
  },
  {
    icon: '🔀',
    title: (
      <Translate id="homepage.feature.dispatch.title">
        On-chain version dispatch
      </Translate>
    ),
    body: (
      <Translate id="homepage.feature.dispatch.body">
        CLI and Web select the Suite v3 (IPFS) or Suite v4 (BYOS) path from the
        on-chain suite version, so legacy repositories keep working while the
        successor path is adopted.
      </Translate>
    ),
  },
  {
    icon: '🌍',
    title: (
      <Translate id="homepage.feature.bilingual.title">
        Bilingual documentation
      </Translate>
    ),
    body: (
      <Translate id="homepage.feature.bilingual.body">
        Every page is authored in English first and mirrored in Simplified
        Chinese. Status wording never runs ahead in either language.
      </Translate>
    ),
  },
];

export default function Home() {
  const { siteConfig, i18n } = useDocusaurusContext();
  const localePrefix = i18n.currentLocale === i18n.defaultLocale ? '' : `/${i18n.currentLocale}`;

  return (
    <Layout
      title={translate({ id: 'homepage.title', message: 'igit' })}
      description={translate({
        id: 'homepage.description',
        message:
          'Next Injective Git — Git hosting with an immutable Injective EVM control plane and a bring-your-own Amazon S3 / Cloudflare R2 storage data plane.',
      })}
    >
      <header className="hero hero-igit">
        <div className="container">
          <img
            src="/img/igit-image.png"
            alt={translate({
              id: 'homepage.hero.logoAlt',
              message: 'Next Injective Git project logo',
            })}
            className="hero-igit-logo margin-bottom--lg"
            width="380"
            height="380"
          />
          <h1 className="hero__title">
            <Translate id="homepage.hero.title">Next Injective Git</Translate>
          </h1>
          <p className="hero__subtitle">
            <Translate id="homepage.hero.tagline">
              Git hosting on Injective: an immutable EVM control plane with a
              bring-your-own-storage data plane — Suite v4 packs into your
              Amazon S3 or Cloudflare R2 bucket, no IPFS node required.
            </Translate>
          </p>
          <div className="buttons-row margin-top--lg">
            <Link className="button button--primary button--lg" to={`${localePrefix}/docs`}>
              <Translate id="homepage.hero.readDocs">Read the Docs</Translate>
            </Link>
            <Link
              className="button button--secondary button--lg margin-left--sm"
              to={`${localePrefix}/docs/project-status`}
            >
              <Translate id="homepage.hero.status">Project Status</Translate>
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="features-igit">
          <div className="container">
            <div className="row">
              {features.map((f, idx) => (
                <div key={idx} className="col col--3">
                  <div className="featureCard-igit text--center padding--md">
                    <div className="featureIcon-igit">{f.icon}</div>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <ContributorsWall localePrefix={localePrefix} />
      </main>
    </Layout>
  );
}
