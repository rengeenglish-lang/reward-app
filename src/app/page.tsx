import { redirect } from 'next/navigation';
import { getInitialData } from './actions';
import Dashboard from './dashboard';

export default async function HomePage() {
  try { const initialData=await getInitialData(); return <Dashboard key={String((initialData.classrooms[0] as {id:string}|undefined)?.id||'empty')} initialData={initialData} />; }
  catch { redirect('/login'); }
}
