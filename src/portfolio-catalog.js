import {resourceFromUrl} from '../shared/resources.js';

// Editorial directory of real public addresses. These are NOT live search results,
// a popularity ranking, or a claim of affiliation. Colors remain procedural.
const entries=[
  ['https://www.youtube.com/@NASA','NASA','Canal de vídeos da NASA.','Mídia','espaço astronomia ciência space'],
  ['https://github.com/mrdoob/three.js','Three.js','Biblioteca JavaScript para criar experiências 3D na web.','Tecnologia','webgl javascript programação código 3d', 'repository'],
  ['https://developer.mozilla.org/pt-BR/','MDN Web Docs','Documentação de tecnologias abertas da web.','Educação','html css javascript programação documentação'],
  ['https://www.youtube.com/@manualdomundo','Manual do Mundo','Canal brasileiro de experiências e divulgação científica.','Mídia','ciência experiências educação iberê'],
  ['https://github.com/','GitHub','Plataforma de hospedagem e colaboração em projetos de código.','Tecnologia','programação código projetos opensource'],
  ['https://www.youtube.com/@veritasium','Veritasium','Canal de divulgação científica.','Mídia','ciência física science'],
  ['https://openlibrary.org/','Open Library','Catálogo aberto de livros, parte do Internet Archive.','Educação','livros leitura biblioteca books'],
  ['https://commons.wikimedia.org/','Wikimedia Commons','Repositório de arquivos multimídia com informações de licença.','Mídia','imagens fotos fotografia arte'],
  ['https://www.youtube.com/@kurzgesagt','Kurzgesagt – In a Nutshell','Canal de vídeos de divulgação científica em animação.','Mídia','ciência animação espaço science'],
  ['https://www.nasa.gov/','NASA · site','Site da agência espacial dos Estados Unidos.','Educação','astronomia espaço space'],
  ['https://github.com/vitejs/vite','Vite','Ferramentas de desenvolvimento para projetos web.','Tecnologia','javascript frontend programação código','repository'],
  ['https://www.youtube.com/@CursoemVideo','Curso em Vídeo','Canal de cursos de tecnologia e programação.','Mídia','guanabara programação python curso educação'],
  ['https://www.blender.org/','Blender','Software livre para criação de conteúdo tridimensional.','Tecnologia','3d arte animação modelagem'],
  ['https://www.wikipedia.org/','Wikipédia','Enciclopédia colaborativa em diversos idiomas.','Wiki','artigos conhecimento pesquisa'],
  ['https://www.youtube.com/@TED','TED','Canal de palestras e apresentações.','Mídia','ideias educação palestras talks'],
  ['https://www.freecodecamp.org/','freeCodeCamp','Comunidade e materiais para aprender programação.','Educação','cursos código javascript python'],
  ['https://github.com/godotengine/godot','Godot Engine','Motor de jogos de código aberto.','Jogos','games 2d 3d programação','repository'],
  ['https://www.youtube.com/@Google','Google · canal','Endereço público do canal Google no YouTube.','Mídia','tecnologia google'],
  ['https://www.gutenberg.org/','Project Gutenberg','Biblioteca de livros digitais; disponibilidade jurídica varia por país.','Educação','livros leitura literatura books'],
  ['https://www.openstreetmap.org/','OpenStreetMap','Projeto colaborativo de dados geográficos abertos.','Comunidade','mapas geografia cidade'],
  ['https://itch.io/','itch.io','Plataforma de publicação de jogos independentes.','Jogos','indie games jogos'],
  ['https://www.bbc.com/portuguese','BBC News Brasil','Página de notícias em português da BBC.','Notícias','jornal notícias brasil mundo'],
  ['https://www.khanacademy.org/','Khan Academy','Plataforma de recursos educacionais.','Educação','matemática ciência cursos'],
  ['https://www.figma.com/','Figma','Ferramentas de design de interfaces e colaboração.','Tecnologia','design interface ux ui'],
  ['https://www.mercadolivre.com.br/','Mercado Livre','Endereço do marketplace brasileiro.','Loja','compras loja produtos comércio'],
  ['https://www.python.org/','Python','Site da linguagem de programação Python.','Tecnologia','programação código linguagem'],
  ['https://www.artstation.com/','ArtStation','Plataforma de portfólios de arte.','Comunidade','arte artistas design 3d'],
  ['https://www.spotify.com/','Spotify','Plataforma de áudio e música.','Música','músicas podcast audio'],
  ['https://www.youtube.com/@SpaceToday','Space Today','Canal brasileiro de divulgação de astronomia.','Mídia','sergio sacani espaço astronomia ciência'],
  ['https://github.com/facebook/react','React','Biblioteca para interfaces de usuário.','Tecnologia','javascript frontend programação','repository'],
  ['https://archive.org/','Internet Archive','Biblioteca digital e preservação de materiais da internet.','Educação','livros arquivos vídeos história'],
  ['https://www.w3.org/','W3C','Organização de padrões para a World Wide Web.','Tecnologia','web html css padrões acessibilidade']
];

export const PORTFOLIO_CATALOG=entries.map(([url,title,description,category,tags,kind],i)=>({
  ...resourceFromUrl(url,{title,description,source:'Catálogo editorial Worldnet'}),
  ...(kind?{kind}:{}),category,tags,origin:'catalog',catalogOrder:i,
  sourceUrl:url,identityEvidence:'Título e endereço do diretório editorial; sem vínculo oficial.'
}));
