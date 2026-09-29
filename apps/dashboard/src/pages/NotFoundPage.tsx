import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage({ what = 'page' }: { what?: string }) {
  return (
    <>
      <PageHeader title={`This ${what} doesn't exist`} />
      <p>
        It may have been deleted, or the link is wrong. <Link to="/projects">Go to Projects</Link>
      </p>
    </>
  );
}
