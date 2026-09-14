import { SetMetadata } from "../types";

interface RebrickableSet {
  set_num: string;
  name: string;
  year: number;
  num_parts: number;
  set_img_url: string;
}

export async function fetchSetMetadata(setNum: string, apiKey: string): Promise<SetMetadata> {
  const response = await fetch(`https://rebrickable.com/api/v3/lego/sets/${setNum}/`, {
    headers: {
      Authorization: `key ${apiKey}`,
    },
  });

  if (response.status === 404) {
    throw new Error(`Set ${setNum} not found`);
  }

  if (!response.ok) {
    throw new Error(`Rebrickable API error: ${response.status}`);
  }

  const data = (await response.json()) as RebrickableSet;

  return {
    setNum: data.set_num,
    name: data.name,
    pieces: data.num_parts,
    year: data.year,
    imageUrl: data.set_img_url,
  };
}
