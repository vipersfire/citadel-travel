import { redirect } from 'react-router';
export async function loader({ request }: any) {
  const choice = request.headers.get('cookie')?.match(/citadel_lang=(id|en)/)?.[1];
  return redirect(
    '/' + (choice || (/^(en)/i.test(request.headers.get('accept-language') || '') ? 'en' : 'id')),
  );
}
export default function Index() {
  return null;
}
