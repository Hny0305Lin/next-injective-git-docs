import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Translate, { translate } from '@docusaurus/Translate';

// Generated ONLY by `npm run fetch:contributors` (build-time GitHub API pull).
// Never edit this file by hand; never fetch it from the browser.
import contributorsData from '@site/src/generated/contributors.json';

const REPO_URL = 'https://github.com/Hny0305Lin/next-injective-git';

export default function ContributorsWall() {
  const { i18n } = useDocusaurusContext();
  const isZh = i18n.currentLocale === 'zh';
  const list = Array.isArray(contributorsData?.contributors)
    ? contributorsData.contributors
    : [];

  // Data unavailable and no committed cache: hide the section entirely.
  if (list.length === 0) {
    console.warn(
      '[contributors] No contributor data available (fetch failed and no cached contributors.json). Section hidden.',
    );
    return null;
  }

  const stale = contributorsData?.source === 'unavailable-fallback';

  return (
    <section className="contributors-igit">
      <div className="container text--center">
        <h2>
          <Translate id="homepage.contributors.title">Contributors</Translate>
        </h2>
        <p className="contributorsMeta-igit">
          {isZh ? (
            <>
              {list.length} 位贡献者正在推进这个项目 ·{' '}
              <a
                href={`${REPO_URL}/graphs/contributors`}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看全部
              </a>
            </>
          ) : (
            <>
              {list.length} contributor{list.length === 1 ? '' : 's'} keep this
              project moving ·{' '}
              <a
                href={`${REPO_URL}/graphs/contributors`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View all contributors
              </a>
            </>
          )}
        </p>
        <div className="contributorsGrid-igit">
          {list.map((c) => (
            <a
              key={c.login}
              className="contributorItem-igit"
              href={c.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`${c.login} — GitHub`}
            >
              {/* The ONLY remote-image exception: avatars.githubusercontent.com (lazy-loaded). */}
              <img
                className="contributorAvatar-igit"
                src={c.avatarUrl}
                alt={translate(
                  {
                    id: 'homepage.contributors.avatarAlt',
                    message: "GitHub avatar of {login}",
                  },
                  { login: c.login },
                )}
                loading="lazy"
                width="64"
                height="64"
              />
              <span className="contributorName-igit">{c.login}</span>
            </a>
          ))}
        </div>
        {stale && (
          <p className="contributorsNote-igit margin-top--md">
            {isZh
              ? '贡献者列表暂时不可用，当前展示的是上次成功拉取的缓存数据。'
              : 'Live contributor data was unavailable at build time; showing the last successfully fetched cache.'}
          </p>
        )}
      </div>
    </section>
  );
}
