import {createContext,useContext,type ReactNode} from 'react';

export const journeyStages=['Data Lake','Discovery','Integration','Augmentation','Knowledge Graph'] as const;
export type JourneyStage=typeof journeyStages[number];
export type JourneyVisit={stage:JourneyStage;token:number};
type Navigation={lakeId:string;lakeName:string;visit?:JourneyVisit;navigate:(stage:JourneyStage)=>void;consume:(token:number)=>void};
const Context=createContext<Navigation|null>(null);
export function JourneyNavigation({children,...navigation}:Navigation&{children:ReactNode}) {
  return <Context.Provider value={navigation}>{children}</Context.Provider>;
}
export const useJourneyNavigation=()=>useContext(Context);
