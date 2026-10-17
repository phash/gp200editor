import type { Guide } from './types';

export const GP200_EDITOR_PT_BR: Guide = {
  slug: 'valeton-gp-200-editor',
  title: 'Editor Valeton GP-200 para Windows, Mac e Linux',
  description:
    'Edite presets da Valeton GP-200 em qualquer computador: o que o editor oficial faz, onde ele para e como o Preset Forge, grátis no navegador, cobre o resto.',
  updated: '2026-10-17',
  intro:
    'Dá para montar timbres girando os knobs da própria GP-200, mas criar um preset naquela tela pequena é lento. Um editor no computador mostra a cadeia de sinal inteira de uma vez, salva presets como arquivo e facilita o compartilhamento. Este guia compara as duas formas de usar um editor Valeton GP-200 no computador: o aplicativo oficial da Valeton e o Preset Forge, um editor grátis que roda direto no navegador.',
  sections: [
    {
      heading: 'O que um editor da GP-200 faz',
      body: [
        'Todo preset da GP-200 é uma cadeia de onze blocos: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB e VOL. Cada bloco guarda um efeito com até quinze parâmetros. Com um editor você liga e desliga blocos, escolhe o tipo de efeito, ajusta os parâmetros e muda a ordem da cadeia.',
        'Os presets ficam salvos em arquivos .prst. O editor lê e grava esses arquivos, então você pode fazer backup dos seus timbres, baixar presets de outros guitarristas e manter versões diferentes do mesmo som.',
      ],
    },
    {
      heading: 'O editor oficial da Valeton',
      body: [
        'A Valeton oferece um editor próprio para a GP-200 como aplicativo de desktop para Windows. Ele se comunica com a pedaleira via USB e também é a ferramenta usada para atualizar o firmware, então vale mantê-lo instalado mesmo que você edite seus presets em outro lugar.',
        'Fora do Windows, as opções são poucas: não existe versão nativa para Linux, e rodar o aplicativo do Windows no Wine ou numa máquina virtual dá trabalho quando há um dispositivo USB MIDI envolvido.',
      ],
    },
    {
      heading: 'Preset Forge: um editor da GP-200 no navegador',
      body: [
        'O Preset Forge é um editor grátis e não oficial que roda no navegador. Não precisa instalar nada, funciona no Windows, macOS, Linux e ChromeOS e, depois da primeira visita, também funciona offline como PWA.',
      ],
      steps: [
        'Abra um arquivo .prst arrastando-o para o editor, edite cada bloco e parâmetro e salve de novo como arquivo .prst.',
        'Conecte a GP-200 via USB para editar ao vivo: cada alteração é enviada na hora para a pedaleira (Chrome ou Edge).',
        'Puxe um preset da pedaleira com “Carregar” e grave de volta em um slot com “Salvar em [Slot]”.',
        'Importe presets .hlx do Line6 HX Stomp e converta para o formato da GP-200 (experimental).',
        'Navegue pela galeria da comunidade e baixe presets, filtrando por modelo de amp, efeito ou estilo.',
        'Monte setlists com cue points temporizados que trocam os presets na pedaleira durante a música.',
      ],
      links: [
        { href: '/editor', label: 'Abrir o editor' },
        { href: '/gallery', label: 'Ver a galeria de presets' },
      ],
    },
    {
      heading: 'Qual usar?',
      body: [
        'Use o aplicativo da Valeton para atualizar o firmware e se você usa Windows e está satisfeito com ele. Use o Preset Forge se você está no Mac, no Linux ou num Chromebook, se quer editar num computador onde não pode instalar programas, ou se quer compartilhar presets e usar setlists.',
        'Os dois trabalham com os mesmos arquivos .prst, então você pode alternar entre eles quando quiser.',
      ],
    },
    {
      heading: 'Comece em cinco minutos',
      steps: [
        'Abra preset-forge.com/editor no Chrome ou no Edge.',
        'Conecte a GP-200 com um cabo USB e clique em “Conectar GP-200”. Permita o acesso MIDI quando o navegador pedir.',
        'Clique em “Carregar” para puxar o preset atual da pedaleira, ou solte um arquivo .prst na página.',
        'Mude efeitos e parâmetros — com a pedaleira conectada, você ouve cada alteração na hora.',
        'Salve com “Salvar em [Slot]” na pedaleira, ou com “Salvar preset como arquivo” no seu computador.',
      ],
      links: [
        { href: '/guides/prst-file', label: 'O que é um arquivo .prst?' },
        { href: '/guides/gp-200-on-linux', label: 'Usando a GP-200 no Linux' },
      ],
    },
  ],
};

export const PRST_FILE_PT_BR: Guide = {
  slug: 'prst-file',
  title: 'O que é um arquivo .prst? Como abrir presets da Valeton GP-200',
  description:
    'Um arquivo .prst é um preset da Valeton GP-200. Veja o que ele contém, como abrir e editar no navegador e como carregar na sua pedaleira.',
  updated: '2026-10-17',
  intro:
    'Quando você baixa um preset da GP-200 num fórum, de um amigo ou num site de presets GP-200 grátis, recebe um arquivo terminado em .prst. O computador não sabe o que fazer com ele, e abrir num editor de texto só mostra caracteres sem sentido. Este guia explica o que tem dentro de um arquivo .prst e como abrir, editar e usar esse arquivo.',
  sections: [
    {
      heading: 'O que é um arquivo .prst',
      body: [
        'PRST vem de preset. Um arquivo .prst guarda exatamente um preset da pedaleira multiefeitos Valeton GP-200. É um arquivo binário pequeno: presets de usuário têm exatamente 1224 bytes. Por ser binário, um editor de texto não consegue exibi-lo de forma útil.',
      ],
    },
    {
      heading: 'O que tem dentro',
      steps: [
        'O nome do preset e o nome do autor, cada um com até 16 caracteres.',
        'Onze blocos de efeito fixos: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB e VOL.',
        'Para cada bloco: se está ligado ou desligado, qual efeito usa e até quinze valores de parâmetro.',
        'A ordem da cadeia de sinal, além das atribuições do pedal de expressão e dos controladores.',
        'Um checksum no final, que a pedaleira usa para rejeitar arquivos corrompidos.',
      ],
    },
    {
      heading: 'Como abrir um arquivo .prst',
      body: [
        'Você precisa de um editor da GP-200. O Preset Forge abre arquivos .prst direto no navegador, no Windows, macOS e Linux, sem instalar nada.',
      ],
      steps: [
        'Abra o editor.',
        'Arraste o arquivo .prst para a página, ou clique em “Carregar preset do disco” e escolha o arquivo.',
        'O editor mostra a cadeia de sinal completa. Clique em um bloco para ver e alterar os parâmetros.',
      ],
      links: [{ href: '/editor', label: 'Abrir arquivo .prst no editor' }],
    },
    {
      heading: 'Carregando um arquivo .prst na GP-200',
      steps: [
        'Abra o arquivo .prst no editor, como descrito acima.',
        'Conecte a GP-200 via USB e clique em “Conectar GP-200” (Chrome ou Edge).',
        'Escolha o slot de destino na pedaleira e clique em “Salvar em [Slot]”. O preset é gravado na GP-200 e fica pronto para tocar.',
      ],
    },
    {
      heading: 'Onde encontrar arquivos .prst',
      body: [
        'A galeria do Preset Forge tem mais de 150 presets grátis para a GP-200, organizados pelo modelo de amp em que foram criados. Cada um pode ser baixado como arquivo .prst ou aberto direto no editor. Você também pode enviar seus próprios presets e compartilhá-los com um link.',
      ],
      links: [
        { href: '/gallery', label: 'Presets GP-200 grátis' },
        { href: '/amp/marshall-jcm800', label: 'Presets de Marshall JCM800' },
        { href: '/amp/fender-65-twin-reverb', label: "Presets de Fender '65 Twin Reverb" },
      ],
    },
    {
      heading: 'Problemas comuns',
      steps: [
        'O arquivo não carrega: confira se é um preset da GP-200. Arquivos de outros modelos da Valeton não são suportados.',
        'O arquivo foi renomeado ou compactado: descompacte primeiro e confira se ele termina em .prst.',
        'O que você tem é um preset do Line6 HX Stomp (.hlx): carregue no editor mesmo assim — o Preset Forge converte para o formato da GP-200 (experimental).',
      ],
    },
  ],
};

export const GP200_ON_LINUX_PT_BR: Guide = {
  slug: 'gp-200-on-linux',
  title: 'Como usar a Valeton GP-200 no Linux',
  description:
    'O editor oficial da Valeton GP-200 é só para Windows. Veja como editar, organizar e controlar ao vivo seus presets da GP-200 no Linux com o Preset Forge.',
  updated: '2026-05-30',
  intro:
    'A Valeton GP-200 é uma pedaleira multiefeitos muito competente, mas o editor oficial só roda no Windows. Se você usa Linux — Mint, Ubuntu, Fedora, Arch ou qualquer outra distro — não precisa de dual boot nem de uma máquina virtual com Windows só para ajustar seu timbre. O Preset Forge roda inteiro no navegador e é o único editor da GP-200 com suporte de verdade ao Linux. Este guia mostra o fluxo completo para usar a GP-200 no Linux: editar presets e controlar a pedaleira ao vivo via USB MIDI.',
  sections: [
    {
      heading: 'Por que quem usa Linux precisa de outro editor',
      body: [
        'A Valeton distribui o editor da GP-200 como aplicativo de desktop para Windows. Não existe versão nativa para Linux, nem para macOS. Durante anos, isso obrigou guitarristas no Linux a editar presets na mão, pela telinha da pedaleira, ou a manter um computador com Windows só para mexer no timbre.',
        'O Preset Forge substitui esse fluxo. É um aplicativo web: abra no navegador, carregue um arquivo .prst e edite cada slot de efeito, cada parâmetro e a cadeia de sinal inteira. Nada é instalado, e seus presets não saem do seu computador, a não ser que você decida compartilhá-los.',
      ],
    },
    {
      heading: 'O que você precisa',
      body: [
        'A edição de presets funciona em qualquer navegador moderno no Linux. O controle ao vivo via USB MIDI — enviar as alterações para a pedaleira em tempo real — precisa da Web MIDI API, que no Linux só está disponível em navegadores baseados no Chromium (Chrome, Chromium, Brave, Edge). O Firefox e os navegadores WebKit não implementam Web MIDI.',
      ],
      steps: [
        'Um computador com Linux (testado no Linux Mint; qualquer distro com um Chromium atualizado funciona).',
        'Google Chrome, Chromium, Brave ou Edge para MIDI ao vivo — para editar offline, qualquer navegador serve.',
        'Um cabo USB para conectar a GP-200 (só necessário para edição ao vivo).',
        'Opcionalmente, seus arquivos de preset .prst.',
      ],
    },
    {
      heading: 'Editando presets no navegador',
      steps: [
        'Abra o editor em preset-forge.com/editor.',
        'Arraste um arquivo .prst para a página, ou comece com um preset da galeria da comunidade.',
        'Ajuste qualquer efeito: ligue e desligue slots, troque o tipo de efeito e gire os knobs dos parâmetros.',
        'Reordene a cadeia de sinal arrastando os slots — ou, pelo teclado, coloque o foco em um slot e use as setas para movê-lo.',
        'Salve o preset editado de volta num arquivo .prst, pronto para enviar ao vivo ou copiar para a pedaleira.',
      ],
    },
    {
      heading: 'Conectando a GP-200 via USB MIDI no Linux',
      body: [
        'A GP-200 é um dispositivo USB MIDI class-compliant, então o Linux reconhece a pedaleira sem nenhum driver. O ALSA a disponibiliza para o navegador automaticamente — não é preciso configurar regras udev nem módulos do kernel para o uso normal.',
      ],
      steps: [
        'Conecte a GP-200 ao computador com um cabo USB e ligue a pedaleira.',
        'Abra o editor no Chrome ou no Chromium e clique em “Conectar GP-200”.',
        'O navegador pede permissão para acessar dispositivos MIDI (incluindo SysEx). Clique em Permitir — é isso que deixa o Preset Forge conversar com a pedaleira.',
        'O Preset Forge passa por Identity, verificação de Firmware e nomes dos Slots; depois, a barra do dispositivo no topo mostra a pedaleira conectada.',
        'Edite normalmente: ligar e desligar efeitos, mudar parâmetros e reordenar a cadeia são enviados na hora para a GP-200. Use “Carregar” para puxar um preset da pedaleira e “Salvar em [Slot]” para gravar suas alterações de volta.',
      ],
    },
    {
      heading: 'Solução de problemas no Linux',
      steps: [
        '“Conectar” não faz nada ou o pedido de permissão não aparece: provavelmente você está no Firefox ou no Safari. Mude para Chrome, Chromium, Brave ou Edge — Web MIDI não está disponível nos outros.',
        'A pedaleira não aparece na lista: verifique se nenhum outro programa (uma DAW, outra aba do navegador ou uma ferramenta MIDI) já está usando o dispositivo — o ALSA dá acesso exclusivo. Feche o programa e conecte de novo.',
        'A permissão foi bloqueada: clique no ícone de cadeado / MIDI na barra de endereços, reative o MIDI para preset-forge.com e recarregue a página.',
        'Diferenças de firmware: o Preset Forge foi verificado com o firmware 1.8.0. Outras versões costumam funcionar, mas se algo se comportar de forma estranha, confira primeiro a versão do seu firmware.',
      ],
    },
    {
      heading: 'Funciona offline?',
      body: [
        'Sim. O Preset Forge é um PWA, então depois da primeira visita o editor abre sem conexão — prático no estúdio de ensaio ou no palco sem Wi-Fi. A galeria da comunidade e o compartilhamento precisam de internet, mas a edição e o controle ao vivo via USB MIDI não.',
      ],
    },
  ],
};

export const GUIDES_PT_BR: Record<string, Guide> = {
  [GP200_EDITOR_PT_BR.slug]: GP200_EDITOR_PT_BR,
  [PRST_FILE_PT_BR.slug]: PRST_FILE_PT_BR,
  [GP200_ON_LINUX_PT_BR.slug]: GP200_ON_LINUX_PT_BR,
};
