const pipeline = [
  {
    id: "trace",
    title: "记录 V1 视觉 trace",
    copy: "在正确版本里保存整页截图、元素坐标和带上下文的裁剪区域。",
  },
  {
    id: "dom",
    title: "DOM 查询",
    copy: "先用旧 locator 在新版本里找元素，看看是找不到还是找错了。",
  },
  {
    id: "visual",
    title: "视觉验证",
    copy: "用 V1 的 visual locator 在 V2 页面上找最像的候选区域。",
  },
  {
    id: "crawl",
    title: "局部爬取",
    copy: "当前页面没有命中时，向邻近页面扩一跳，检查目标是否被挪走。",
  },
  {
    id: "repair",
    title: "修复合成",
    copy: "把视觉匹配重新映射回 DOM，并生成新 locator 或插入新语句。",
  },
];

const originalCode = [
  { n: 1, text: 'driver.findElement(By.name("user")).sendKeys("user");' },
  { n: 2, text: 'driver.findElement(By.name("password")).sendKeys("pass");' },
  { n: 3, text: 'driver.findElement(By.xpath("//input[@value=\'Login\']")).click();' },
  { n: 4, text: 'driver.findElement(By.linkText("add new")).click();' },
  { n: 5, text: 'driver.findElement(By.xpath("//input[3]")).sendKeys("Name");' },
  { n: 6, text: 'driver.findElement(By.xpath("//input[4]")).sendKeys("LastName");' },
  { n: 7, text: 'driver.findElement(By.xpath("//input[5]")).sendKeys("Company");' },
];

const repairedCode = [
  { n: 1, text: 'driver.findElement(By.name("user")).sendKeys("user");' },
  { n: 2, text: 'driver.findElement(By.name("password")).sendKeys("pass");' },
  { n: 3, text: 'driver.findElement(By.xpath("//button[text()=\'Login\']")).click();' },
  { n: 4, text: 'driver.findElement(By.linkText("add new")).click();' },
  { n: 5, text: 'driver.findElement(By.name("Next")).click();', added: true },
  { n: 6, text: 'driver.findElement(By.xpath("//input[3]")).sendKeys("Name");' },
  { n: 7, text: 'driver.findElement(By.xpath("//input[4]")).sendKeys("LastName");' },
  { n: 8, text: 'driver.findElement(By.xpath("//input[7]")).sendKeys("Company");' },
];

const pages = {
  "v1-login": {
    label: "AddressBook 6.2.12 · Login",
    title: "Welcome back",
    subtitle: "旧版本里 Login 是一个 <input value='Login'>。",
    layout: [
      { type: "field", id: "user-v1", label: "User", value: "user" },
      { type: "field", id: "password-v1", label: "Password", value: "••••••••" },
      { type: "button", id: "login-v1", label: "Login", variant: "legacy" },
    ],
  },
  "v2-login": {
    label: "AddressBook 7.0.0 · Login",
    title: "Welcome back",
    subtitle: "视觉几乎没变，但 DOM 从 input 改成了 button。",
    layout: [
      { type: "field", id: "user-v2", label: "User", value: "user" },
      { type: "field", id: "password-v2", label: "Password", value: "••••••••" },
      { type: "button", id: "login-v2", label: "Login", variant: "primary" },
      { type: "button", id: "cancel-v2", label: "Cancel", variant: "neutral" },
    ],
  },
  "v1-list": {
    label: "AddressBook 6.2.12 · Listing",
    title: "Address entries",
    subtitle: "测试下一步会点 add new 打开表单页。",
    layout: [
      { type: "link", id: "add-link-v1", label: "add new" },
      { type: "table", id: "table-v1", title: "Existing entries", rows: ["Alice Smith", "Bob Chan"] },
    ],
  },
  "v2-list": {
    label: "AddressBook 7.0.0 · Listing",
    title: "Address entries",
    subtitle: "新版本在表单前多了一步确认页面。",
    layout: [
      { type: "link", id: "add-link-v2", label: "add new" },
      { type: "table", id: "table-v2", title: "Existing entries", rows: ["Alice Smith", "Bob Chan"] },
    ],
  },
  "v1-form": {
    label: "AddressBook 6.2.12 · Add Entry",
    title: "Create new contact",
    subtitle: "V1 直接进入表单，Company 是第三个关键字段。",
    layout: [
      { type: "field", id: "first-v1", label: "First name", value: "Name" },
      { type: "field", id: "last-v1", label: "Last name", value: "LastName" },
      { type: "field", id: "company-v1", label: "Company", value: "Company" },
    ],
  },
  "v2-confirm": {
    label: "AddressBook 7.0.0 · Confirm",
    title: "Prepare entry schema",
    subtitle: "这里新增了中间页，所以旧脚本会在当前状态找不到 First name 字段。",
    layout: [
      {
        type: "notice",
        id: "notice-v2",
        title: "A confirmation step was added",
        body: "请选择继续创建联系人。Vista 会把这里视为 workflow breakage 的邻域起点。",
      },
      { type: "button", id: "next-v2", label: "Next", variant: "primary" },
    ],
  },
  "v2-form": {
    label: "AddressBook 7.0.0 · Add Entry",
    title: "Create new contact",
    subtitle: "字段顺序发生偏移，Nickname 插到 Company 前面。",
    layout: [
      { type: "field", id: "first-v2", label: "First name", value: "Name" },
      { type: "field", id: "last-v2", label: "Last name", value: "LastName" },
      { type: "field", id: "nick-v2", label: "Nickname", value: "nickname" },
      { type: "field", id: "company-v2", label: "Company", value: "Company" },
    ],
  },
};

const scenarios = [
  {
    id: "non-selection",
    tabTitle: "Non-selection",
    tabCopy: "旧 locator 返回 0 个元素，但目标在视觉上仍然存在。",
    codeHint: "论文里最直接的 breakage：DOM 变了，但登录按钮还在那里。",
    browserHint: "V1 记录了 Login 按钮的 visual locator，V2 里它从 input 变成了 button。",
    analysisHint: "先 DOM 查询失败，再进入视觉搜索，最后把命中的屏幕坐标重新映射回 DOM。",
    stages: [
      {
        id: "trace",
        title: "录制 V1 的 Login visual locator",
        caption: "在正确版本里，Vista 保存登录页截图、元素坐标和上下文裁剪区域。",
        pipeline: "trace",
        v1Page: "v1-login",
        v2Page: "v2-login",
        v1Focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "V1 trace" }],
        metrics: [
          { label: "当前语句", value: "Line 3 · click(Login)" },
          { label: "DOM 结果", value: "尚未执行 V2 查询" },
          { label: "视觉资产", value: "整页截图 + 居中裁剪模板" },
        ],
        logs: [
          "拦截 Selenium 的 click() 调用，记录 Line 3 与页面的对应关系。",
          "保存登录页整张截图，并取出 Login 按钮周围的视觉上下文。",
          "把 locator、语句、截图和模板图写入可复用 trace。",
        ],
        candidates: [
          {
            title: "Login 模板",
            score: "trace",
            best: true,
            text: "按钮文字、尺寸和相对位置都会作为后续 V2 视觉搜索的输入。",
            tags: ["text=Login", "type=button", "context=user/password"],
          },
        ],
        template: {
          title: "Captured around Login",
          note: "论文里这一步由 Visual Execution Tracer 完成。",
          locator: "//input[@value='Login']",
          page: "v1-login",
          focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "template" }],
        },
        repair: {
          title: "等待生成",
          note: "V2 还没执行，暂时没有 repair。",
          code: "Repair will be synthesized after visual validation.",
        },
        originalLines: [3],
        repairedLines: [3],
      },
      {
        id: "dom",
        title: "旧 locator 在 V2 中失效",
        caption: "DOM 查询 `//input[@value='Login']` 返回 0 个元素。",
        pipeline: "dom",
        v1Page: "v1-login",
        v2Page: "v2-login",
        v1Focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "template" }],
        metrics: [
          { label: "当前语句", value: "Line 3 · click(Login)" },
          { label: "DOM 结果", value: "0 hits · non-selection" },
          { label: "Vista 判断", value: "转入视觉搜索而不是直接报错" },
        ],
        logs: [
          "使用旧 XPath 在 V2 DOM 中查询，没有返回任何 WebElement。",
          "这不是应用逻辑错误，更像是 locator 与 DOM 脱同步。",
          "Vista 根据 V1 trace 判断：应该先确认按钮是不是还视觉存在。",
        ],
        candidates: [
          {
            title: "DOM locator miss",
            score: "0 hits",
            text: "旧 locator 依赖 `<input value='Login'>`，但新版本已经改成 `<button>`。",
            tags: ["tag changed", "attribute removed"],
          },
        ],
        template: {
          title: "Login template retained",
          note: "接下来用它在整张 V2 页面里找最像的区域。",
          locator: "//input[@value='Login']",
          page: "v1-login",
          focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "template" }],
        },
        repair: {
          title: "尚未修复",
          note: "单靠 DOM 这一步没有可用答案。",
          code: "DOM-only approach stops here.",
        },
        originalLines: [3],
        repairedLines: [3],
      },
      {
        id: "visual",
        title: "视觉搜索命中新按钮",
        caption: "视觉模板在 V2 中找到 `<button>Login</button>`，并过滤掉误报。",
        pipeline: "visual",
        v1Page: "v1-login",
        v2Page: "v2-login",
        v1Focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "template" }],
        v2Focus: [{ id: "login-v2", mode: "visual", badge: "visual", text: "best match" }],
        metrics: [
          { label: "视觉结果", value: "best match = Login button" },
          { label: "过滤逻辑", value: "模板相关性 + 上下文一致性" },
          { label: "下一步", value: "elementFromPoint(x, y) 回到 DOM" },
        ],
        logs: [
          "对模板做视觉匹配，优先保留文字、形状和局部上下文都接近的区域。",
          "Cancel 虽然也是按钮，但文字和相对位置不符，被判成低分候选。",
          "最佳候选位于屏幕中心的 Login 按钮，进入 GUI-to-DOM 映射。",
        ],
        candidates: [
          {
            title: "Login button",
            score: "0.99",
            best: true,
            text: "文字一致，尺寸接近，位于 user/password 字段之后。",
            tags: ["exact text", "same role", "same visual context"],
          },
          {
            title: "Cancel button",
            score: "0.47",
            text: "形状接近，但文字和语义不匹配。",
            tags: ["wrong text", "wrong intent"],
          },
          {
            title: "User field",
            score: "0.21",
            text: "同页元素，但类型完全不对。",
            tags: ["wrong type"],
          },
        ],
        template: {
          title: "Login visual locator",
          note: "论文里这一块通过 SIFT/FAST + 模板匹配管线实现；这里是交互式简化演示。",
          locator: "template crop around Login",
          page: "v1-login",
          focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "template" }],
        },
        repair: {
          title: "Screen coordinate -> DOM",
          note: "利用命中的中心点重新拿到 V2 里的 DOM 元素。",
          code: "elementFromPoint(x, y) => <button>Login</button>",
        },
        originalLines: [3],
        repairedLines: [3],
      },
      {
        id: "repair",
        title: "生成更稳健的新 locator",
        caption: "Vista 把匹配到的按钮转成新的测试语句。",
        pipeline: "repair",
        v1Page: "v1-login",
        v2Page: "v2-login",
        v1Focus: [{ id: "login-v1", mode: "trace", badge: "trace", text: "trace" }],
        v2Focus: [{ id: "login-v2", mode: "visual", badge: "visual", text: "repair target" }],
        metrics: [
          { label: "修复类型", value: "Replace locator" },
          { label: "新 locator", value: "//button[text()='Login']" },
          { label: "效果", value: "Line 3 在 V2 可继续执行" },
        ],
        logs: [
          "通过 GUI-to-DOM 映射得到目标节点是 `<button>`。",
          "生成新的可读 locator，替换掉依赖旧属性的 XPath。",
          "测试在这一行恢复同步，后续步骤可以继续往下跑。",
        ],
        candidates: [
          {
            title: "Applied repair",
            score: "accepted",
            best: true,
            text: "Line 3 从 `//input[@value='Login']` 替换为 `//button[text()='Login']`。",
            tags: ["locator regenerated", "DOM synchronized"],
          },
        ],
        template: {
          title: "Validated visual target",
          note: "这一步对应论文里的 locator generator。",
          locator: "best visual match => DOM element",
          page: "v2-login",
          focus: [{ id: "login-v2", mode: "visual", badge: "visual", text: "matched" }],
        },
        repair: {
          title: "Line 3 repaired",
          note: "这是最典型的 non-selection 修复结果。",
          code: 'driver.findElement(By.xpath("//button[text()=\'Login\']")).click();',
        },
        originalLines: [3],
        repairedLines: [3],
      },
    ],
  },
  {
    id: "workflow",
    tabTitle: "Broken Workflow",
    tabCopy: "目标不在当前页，页面流转被插入了新状态。",
    codeHint: "论文里的中间确认页就是 workflow repair 的代表场景。",
    browserHint: "旧版本点击 add new 后直接出现表单，新版本先进入确认页，再点 Next 才能到表单。",
    analysisHint: "当前页面找不到目标时，Vista 会在 breakage 邻域做一跳局部爬取。",
    stages: [
      {
        id: "trace",
        title: "录制 V1 表单里的 First name 字段",
        caption: "在 V1 表单页上，Vista 记录 Line 5 对应的视觉目标。",
        pipeline: "trace",
        v1Page: "v1-form",
        v2Page: "v2-confirm",
        v1Focus: [{ id: "first-v1", mode: "trace", badge: "trace", text: "template" }],
        metrics: [
          { label: "当前语句", value: "Line 5 · sendKeys(First name)" },
          { label: "预期页面", value: "直接进入 Add Entry 表单" },
          { label: "视觉资产", value: "First name 字段模板" },
        ],
        logs: [
          "V1 里点击 add new 后立刻进入表单页，Line 5 可以直接命中 First name。",
          "Vista 保存该字段的视觉模板，供 V2 回归执行时重用。",
          "模板不仅是输入框本身，也携带附近标题和字段排布上下文。",
        ],
        candidates: [
          {
            title: "First name template",
            score: "trace",
            best: true,
            text: "模板来自 V1 表单页第一项输入框。",
            tags: ["field", "top of form", "label=First name"],
          },
        ],
        template: {
          title: "Captured around First name",
          note: "接下来 V2 会从当前页开始检查这个目标还在不在。",
          locator: "//input[3]",
          page: "v1-form",
          focus: [{ id: "first-v1", mode: "trace", badge: "trace", text: "template" }],
        },
        repair: {
          title: "等待检测",
          note: "V2 还没发现 breakage。",
          code: "No repair yet.",
        },
        originalLines: [5],
        repairedLines: [5, 6],
      },
      {
        id: "dom",
        title: "旧脚本在确认页找不到字段",
        caption: "旧脚本认为当前状态就是表单，但 V2 已经多出了一步确认页。",
        pipeline: "dom",
        v1Page: "v1-form",
        v2Page: "v2-confirm",
        v1Focus: [{ id: "first-v1", mode: "trace", badge: "trace", text: "template" }],
        metrics: [
          { label: "当前语句", value: "Line 5 · sendKeys(First name)" },
          { label: "DOM 结果", value: "NoSuchElementException" },
          { label: "Vista 判断", value: "更像是 workflow 断裂，不是字段被删" },
        ],
        logs: [
          "执行到 Line 5 时，当前页没有任何 First name 对应输入框。",
          "如果只看异常堆栈，很容易误以为是 locator 本身坏了。",
          "Vista 保留页面视觉上下文，所以会进一步判断目标是否被移动到了邻近页面。",
        ],
        candidates: [
          {
            title: "Current page = Confirm",
            score: "0 match",
            text: "这一页只有说明文字和 Next 按钮，没有表单字段。",
            tags: ["wrong state", "workflow changed"],
          },
        ],
        template: {
          title: "Missing in current state",
          note: "当前确认页没有任何区域接近 First name 模板。",
          locator: "//input[3]",
          page: "v2-confirm",
          focus: [{ id: "next-v2", mode: "dom", badge: "dom", text: "current page" }],
        },
        repair: {
          title: "转入 local crawl",
          note: "下一步不是换 locator，而是探索当前状态一跳范围内的页面。",
          code: "Explore neighbors of current page",
        },
        originalLines: [5],
        repairedLines: [5, 6],
      },
      {
        id: "crawl",
        title: "局部爬取发现目标被挪到了下一页",
        caption: "Vista 在确认页邻域点击 Next，发现目标字段出现在新页面。",
        pipeline: "crawl",
        v1Page: "v1-form",
        v2Page: "v2-confirm",
        v1Focus: [{ id: "first-v1", mode: "trace", badge: "trace", text: "template" }],
        metrics: [
          { label: "爬取范围", value: "1 hop from current state" },
          { label: "发现页面", value: "Confirm -> Next -> Add Entry" },
          { label: "视觉结果", value: "First name found on discovered page" },
        ],
        logs: [
          "Vista 在当前状态枚举可点击动作，把 Next 视为高价值邻居边。",
          "点击 Next 后，发现新页面的顶部字段与 V1 模板高度相似。",
          "因此 breakage 被归因为 workflow 变化，而不是字段消失。",
        ],
        candidates: [
          {
            title: "Discovered page: Add Entry",
            score: "0.98",
            best: true,
            text: "第一跳页面里成功找到了 First name 模板的视觉匹配。",
            tags: ["1 hop away", "visual hit", "state recovered"],
          },
          {
            title: "Stay on confirm page",
            score: "0.00",
            text: "当前状态没有任何可接受候选。",
            tags: ["no form fields"],
          },
        ],
        crawl: [
          {
            title: "Current state",
            label: "Confirm page",
            copy: "只包含说明文字和 Next 按钮。",
          },
          {
            title: "Discovered action",
            label: "Click Next",
            copy: "这条边被加入修复脚本中作为新语句。",
          },
          {
            title: "Recovered state",
            label: "Add Entry form",
            copy: "First name 字段再次可见，后续输入语句可恢复。",
          },
        ],
        template: {
          title: "Template survives across pages",
          note: "这正是论文里 local crawling 的用途：目标不在当前页，但还在邻域内。",
          locator: "visual search on neighboring states",
          page: "v2-form",
          focus: [{ id: "first-v2", mode: "visual", badge: "visual", text: "discovered" }],
        },
        repair: {
          title: "Insert missing transition",
          note: "修复动作不是改 Line 5，而是在它前面补一个跳转。",
          code: 'driver.findElement(By.name("Next")).click();',
        },
        originalLines: [5],
        repairedLines: [5, 6],
      },
      {
        id: "repair",
        title: "把新跳转插入修复脚本",
        caption: "最终修复是在表单填写前插入一条新的 click(Next)。",
        pipeline: "repair",
        v1Page: "v1-form",
        v2Page: "v2-form",
        v1Focus: [{ id: "first-v1", mode: "trace", badge: "trace", text: "trace" }],
        v2Focus: [{ id: "first-v2", mode: "visual", badge: "visual", text: "reachable" }],
        metrics: [
          { label: "修复类型", value: "Insert statement" },
          { label: "新语句", value: 'Line 5 = By.name("Next").click()' },
          { label: "效果", value: "Line 6 开始重新命中表单字段" },
        ],
        logs: [
          "确认目标并未消失，只是移动到了下一状态。",
          "因此 Vista 在修复脚本里插入新的过渡语句，而不是盲目改输入框 locator。",
          "修复后的测试工作流重新与应用状态机对齐。",
        ],
        candidates: [
          {
            title: "Workflow repaired",
            score: "accepted",
            best: true,
            text: "插入 `driver.findElement(By.name(\"Next\")).click();` 后，后续输入行继续可用。",
            tags: ["state transition restored", "neighbor crawl"],
          },
        ],
        template: {
          title: "Recovered target state",
          note: "Line 6 会在修复后的状态里继续执行。",
          locator: "neighbor page with First name",
          page: "v2-form",
          focus: [{ id: "first-v2", mode: "visual", badge: "visual", text: "reached" }],
        },
        repair: {
          title: "Line 5 inserted",
          note: "这是 workflow repair 的核心。",
          code: 'driver.findElement(By.name("Next")).click();',
        },
        originalLines: [5],
        repairedLines: [5, 6],
      },
    ],
  },
  {
    id: "mis-selection",
    tabTitle: "Mis-selection",
    tabCopy: "旧 locator 仍然能选中元素，但已经不是“视觉上那个目标”。",
    codeHint: "这是最容易被忽略的一类问题，因为脚本表面上还能继续跑。",
    browserHint: "V2 表单里插入了 Nickname 字段，旧 XPath 仍会命中，但命中了错误输入框。",
    analysisHint: "Vista 会把 DOM 命中结果与视觉匹配结果做 sanity check，发现分歧后再修复。",
    stages: [
      {
        id: "trace",
        title: "录制 V1 的 Company 字段模板",
        caption: "在旧表单页中，Line 7 对应的是 Company 字段。",
        pipeline: "trace",
        v1Page: "v1-form",
        v2Page: "v2-form",
        v1Focus: [{ id: "company-v1", mode: "trace", badge: "trace", text: "template" }],
        metrics: [
          { label: "当前语句", value: "Line 7 · sendKeys(Company)" },
          { label: "V1 目标", value: "Company field" },
          { label: "后续用途", value: "验证 DOM 选中的是否还是同一个视觉目标" },
        ],
        logs: [
          "V1 中 Company 是第三个重要字段，Line 7 可以稳定填写它。",
          "Vista 记录其视觉模板，以便在 V2 中确认旧 XPath 是否仍然指向同一元素。",
          "这一步是 mis-selection 检测成立的前提。",
        ],
        candidates: [
          {
            title: "Company template",
            score: "trace",
            best: true,
            text: "模板包含标签文字 Company 以及它在表单底部的位置。",
            tags: ["label=Company", "bottom of form"],
          },
        ],
        template: {
          title: "Captured around Company",
          note: "这一步记录的是“视觉身份”，不是 DOM identity。",
          locator: "//input[5]",
          page: "v1-form",
          focus: [{ id: "company-v1", mode: "trace", badge: "trace", text: "template" }],
        },
        repair: {
          title: "等待对比",
          note: "下一步会把 DOM 命中和视觉命中放在一起比较。",
          code: "Need sanity check first.",
        },
        originalLines: [7],
        repairedLines: [8],
      },
      {
        id: "dom",
        title: "旧 XPath 仍能命中，但命中了 Nickname",
        caption: "这是误导性最强的情况：旧脚本看起来没崩，但已经填错字段。",
        pipeline: "dom",
        v1Page: "v1-form",
        v2Page: "v2-form",
        v1Focus: [{ id: "company-v1", mode: "trace", badge: "trace", text: "template" }],
        v2Focus: [{ id: "nick-v2", mode: "mismatch", badge: "mismatch", text: "DOM hit" }],
        metrics: [
          { label: "DOM 结果", value: "Hit = Nickname field" },
          { label: "风险", value: "测试继续执行，但语义已偏离" },
          { label: "Vista 动作", value: "触发视觉 sanity check" },
        ],
        logs: [
          "旧 XPath 在 V2 中仍然返回了一个输入框，因此普通 DOM-only 方案会误以为没问题。",
          "但这个输入框实际标签是 Nickname，而不是 Company。",
          "Vista 因为保留了 V1 的视觉模板，所以会继续做视觉一致性校验。",
        ],
        candidates: [
          {
            title: "DOM-selected Nickname",
            score: "selected",
            text: "结构位置相近，但标签语义发生了变化。",
            tags: ["wrong semantic target", "test may silently diverge"],
          },
        ],
        template: {
          title: "Need visual confirmation",
          note: "只靠 DOM 命中不足以说明它还是正确元素。",
          locator: "sanity check pending",
          page: "v2-form",
          focus: [{ id: "nick-v2", mode: "mismatch", badge: "mismatch", text: "dom hit" }],
        },
        repair: {
          title: "尚不能接受",
          note: "先比较视觉结果，再决定是否修复。",
          code: "DOM hit is not trusted yet.",
        },
        originalLines: [7],
        repairedLines: [8],
      },
      {
        id: "visual",
        title: "视觉匹配指出真正的 Company 字段",
        caption: "DOM 命中与视觉命中不一致，说明发生了 mis-selection。",
        pipeline: "visual",
        v1Page: "v1-form",
        v2Page: "v2-form",
        v1Focus: [{ id: "company-v1", mode: "trace", badge: "trace", text: "template" }],
        v2Focus: [
          { id: "nick-v2", mode: "mismatch", badge: "mismatch", text: "DOM hit" },
          { id: "company-v2", mode: "visual", badge: "visual", text: "visual hit" },
        ],
        metrics: [
          { label: "DOM 命中", value: "Nickname" },
          { label: "视觉命中", value: "Company" },
          { label: "Vista 判断", value: "locator disagreement => mis-selection" },
        ],
        logs: [
          "视觉搜索更偏向标签为 Company、位于表单末尾的输入框。",
          "Nickname 虽然位置接近，但标签语义和视觉上下文不对。",
          "Vista 将这类 DOM/视觉分歧标记为 mis-selection，而不是继续静默执行。",
        ],
        candidates: [
          {
            title: "Company field",
            score: "0.97",
            best: true,
            text: "标签完全一致，整体上下文与 V1 模板最接近。",
            tags: ["same label", "same role", "best visual context"],
          },
          {
            title: "Nickname field",
            score: "0.61",
            text: "输入框外观相似，但语义不一致。",
            tags: ["wrong label"],
          },
          {
            title: "Last name field",
            score: "0.34",
            text: "同类控件，但位置和标签都偏差较大。",
            tags: ["low similarity"],
          },
        ],
        template: {
          title: "DOM and visual disagree",
          note: "论文强调这类 breakage 很难只靠异常栈发现。",
          locator: "sanity check mismatch",
          page: "v2-form",
          focus: [{ id: "company-v2", mode: "visual", badge: "visual", text: "should target" }],
        },
        repair: {
          title: "Prepare locator update",
          note: "下一步把真正的 Company 字段重新映射成新 locator。",
          code: "Mismatch detected. Regenerate locator.",
        },
        originalLines: [7],
        repairedLines: [8],
      },
      {
        id: "repair",
        title: "更新到能重新指向 Company 的 locator",
        caption: "Vista 不接受原命中结果，而是把真实视觉目标写回测试脚本。",
        pipeline: "repair",
        v1Page: "v1-form",
        v2Page: "v2-form",
        v1Focus: [{ id: "company-v1", mode: "trace", badge: "trace", text: "trace" }],
        v2Focus: [{ id: "company-v2", mode: "visual", badge: "visual", text: "repair target" }],
        metrics: [
          { label: "修复类型", value: "Replace wrong locator" },
          { label: "新 locator", value: "//input[7]" },
          { label: "效果", value: "Line 8 再次填写 Company，而不是 Nickname" },
        ],
        logs: [
          "Vista 以视觉命中的 Company 字段为准，拒绝 DOM 误命中结果。",
          "重新生成对应 locator，把脚本重新绑回语义正确的输入框。",
          "这类修复避免了测试在表面成功、实际上已经偏航的情况。",
        ],
        candidates: [
          {
            title: "Applied repair",
            score: "accepted",
            best: true,
            text: "Line 7 的旧 XPath 被替换为能命中 Company 的新 locator `//input[7]`。",
            tags: ["mis-selection fixed", "visual sanity check"],
          },
        ],
        template: {
          title: "Correct field recovered",
          note: "视觉目标与最终修复脚本再次一致。",
          locator: "best match => Company",
          page: "v2-form",
          focus: [{ id: "company-v2", mode: "visual", badge: "visual", text: "matched" }],
        },
        repair: {
          title: "Line 8 repaired",
          note: "修复脚本里 Company 对应语句移到了新位置。",
          code: 'driver.findElement(By.xpath("//input[7]")).sendKeys("Company");',
        },
        originalLines: [7],
        repairedLines: [8],
      },
    ],
  },
];

const refs = {
  pipelineSteps: document.getElementById("pipelineSteps"),
  pipelineCaption: document.getElementById("pipelineCaption"),
  scenarioTabs: document.getElementById("scenarioTabs"),
  stageTabs: document.getElementById("stageTabs"),
  originalCode: document.getElementById("originalCode"),
  repairedCode: document.getElementById("repairedCode"),
  codeHint: document.getElementById("codeHint"),
  browserHint: document.getElementById("browserHint"),
  analysisHint: document.getElementById("analysisHint"),
  v1Label: document.getElementById("v1Label"),
  v2Label: document.getElementById("v2Label"),
  v1Viewport: document.getElementById("v1Viewport"),
  v2Viewport: document.getElementById("v2Viewport"),
  templateTitle: document.getElementById("templateTitle"),
  templatePreview: document.getElementById("templatePreview"),
  templateNote: document.getElementById("templateNote"),
  repairTitle: document.getElementById("repairTitle"),
  repairPreview: document.getElementById("repairPreview"),
  repairNote: document.getElementById("repairNote"),
  metricChips: document.getElementById("metricChips"),
  logList: document.getElementById("logList"),
  candidateList: document.getElementById("candidateList"),
  crawlPanel: document.getElementById("crawlPanel"),
  prevStageBtn: document.getElementById("prevStageBtn"),
  nextStageBtn: document.getElementById("nextStageBtn"),
  playAllBtn: document.getElementById("playAllBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

const state = {
  scenarioIndex: 0,
  stageIndex: 0,
  autoplayId: 0,
  isAutoplay: false,
};

function currentScenario() {
  return scenarios[state.scenarioIndex];
}

function currentStage() {
  return currentScenario().stages[state.stageIndex];
}

function stopAutoplay() {
  if (state.autoplayId) {
    window.clearTimeout(state.autoplayId);
    state.autoplayId = 0;
  }
  state.isAutoplay = false;
}

function nextPosition() {
  const scenario = currentScenario();
  if (state.stageIndex < scenario.stages.length - 1) {
    state.stageIndex += 1;
    return true;
  }
  if (state.scenarioIndex < scenarios.length - 1) {
    state.scenarioIndex += 1;
    state.stageIndex = 0;
    return true;
  }
  return false;
}

function prevPosition() {
  if (state.stageIndex > 0) {
    state.stageIndex -= 1;
    return true;
  }
  if (state.scenarioIndex > 0) {
    state.scenarioIndex -= 1;
    state.stageIndex = scenarios[state.scenarioIndex].stages.length - 1;
    return true;
  }
  return false;
}

function renderCode(target, lines, activeLines) {
  target.innerHTML = "";
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "code-line";
    if (activeLines.includes(line.n)) row.classList.add("is-active");
    if (line.added) row.classList.add("is-added");

    const no = document.createElement("span");
    no.className = "line-no";
    no.textContent = String(line.n).padStart(2, "0");

    const text = document.createElement("span");
    text.textContent = line.text;

    row.append(no, text);
    target.append(row);
  });
}

function buildEntity(node, marks) {
  let element;
  if (node.type === "field") {
    element = document.createElement("div");
    element.className = "field entity";
    const label = document.createElement("label");
    label.textContent = node.label;
    const input = document.createElement("span");
    input.textContent = node.value;
    element.append(label, input);
  } else if (node.type === "button") {
    element = document.createElement("button");
    element.type = "button";
    element.className = `buttonish ${node.variant || "neutral"} entity`;
    element.textContent = node.label;
  } else if (node.type === "link") {
    element = document.createElement("div");
    element.className = "linkish entity";
    element.textContent = node.label;
  } else if (node.type === "table") {
    element = document.createElement("div");
    element.className = "table-card entity";
    const title = document.createElement("strong");
    title.textContent = node.title;
    const list = document.createElement("ul");
    node.rows.forEach((row) => {
      const li = document.createElement("li");
      li.textContent = row;
      list.append(li);
    });
    element.append(title, list);
  } else if (node.type === "notice") {
    element = document.createElement("div");
    element.className = "notice-card entity";
    const title = document.createElement("strong");
    title.textContent = node.title;
    const text = document.createElement("p");
    text.textContent = node.body;
    element.append(title, text);
  }

  const mark = marks.find((item) => item.id === node.id);
  if (mark) {
    if (mark.mode === "dom") element.classList.add("is-dom-hit");
    if (mark.mode === "visual") element.classList.add("is-visual-hit");
    if (mark.mode === "trace") element.classList.add("is-trace-hit");
    if (mark.mode === "mismatch") element.classList.add("is-mismatch");

    if (mark.badge) {
      const badge = document.createElement("span");
      badge.className = `entity-badge ${mark.badge}`;
      badge.textContent = mark.text || mark.badge;
      element.append(badge);
    }
  }

  return element;
}

function renderPage(target, pageId, marks = []) {
  target.innerHTML = "";
  const page = pages[pageId];
  if (!page) return;

  const root = document.createElement("div");
  root.className = "browser-app";

  const windowEl = document.createElement("div");
  windowEl.className = "app-window";

  const toolbar = document.createElement("div");
  toolbar.className = "app-toolbar";
  const brand = document.createElement("div");
  brand.className = "app-brand";
  brand.textContent = page.label;
  const dots = document.createElement("div");
  dots.className = "app-dots";
  dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
  toolbar.append(brand, dots);

  const panel = document.createElement("div");
  panel.className = "app-panel";
  const title = document.createElement("h3");
  title.textContent = page.title;
  const subtitle = document.createElement("p");
  subtitle.textContent = page.subtitle;
  panel.append(title, subtitle);

  const stack = document.createElement("div");
  stack.className = "stack";

  page.layout.forEach((node) => {
    const block = buildEntity(node, marks);
    stack.append(block);
  });

  panel.append(stack);
  windowEl.append(toolbar, panel);
  root.append(windowEl);
  target.append(root);
}

function renderTemplate(stage) {
  refs.templateTitle.textContent = stage.template.title;
  refs.templateNote.textContent = stage.template.note;
  refs.templatePreview.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "stack";

  const pill = document.createElement("div");
  pill.className = "locator-pill";
  pill.textContent = stage.template.locator;
  wrap.append(pill);

  const previewHost = document.createElement("div");
  previewHost.style.minHeight = "140px";
  renderPage(previewHost, stage.template.page, stage.template.focus || []);
  wrap.append(previewHost.firstElementChild);

  refs.templatePreview.append(wrap);
}

function renderRepair(stage) {
  refs.repairTitle.textContent = stage.repair.title;
  refs.repairNote.textContent = stage.repair.note;
  refs.repairPreview.innerHTML = "";

  const block = document.createElement("div");
  block.className = "repair-block";
  block.textContent = stage.repair.code;
  refs.repairPreview.append(block);
}

function renderMetrics(stage) {
  refs.metricChips.innerHTML = "";
  stage.metrics.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "metric-chip";
    chip.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    refs.metricChips.append(chip);
  });
}

function renderLogs(stage) {
  refs.logList.innerHTML = "";
  stage.logs.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    refs.logList.append(item);
  });
}

function renderCandidates(stage) {
  refs.candidateList.innerHTML = "";
  stage.candidates.forEach((candidate) => {
    const card = document.createElement("article");
    card.className = "candidate-item";
    if (candidate.best) card.classList.add("is-best");

    const tags = (candidate.tags || [])
      .map((tag) => `<span class="candidate-score">${tag}</span>`)
      .join("");

    card.innerHTML = `
      <div class="candidate-head">
        <h4>${candidate.title}</h4>
        <span class="candidate-score">${candidate.score}</span>
      </div>
      <p>${candidate.text}</p>
      <div class="candidate-tags">${tags}</div>
    `;
    refs.candidateList.append(card);
  });
}

function renderCrawl(stage) {
  refs.crawlPanel.innerHTML = "";
  if (!stage.crawl) {
    refs.crawlPanel.classList.remove("is-visible");
    return;
  }

  refs.crawlPanel.classList.add("is-visible");
  stage.crawl.forEach((item) => {
    const card = document.createElement("article");
    card.className = "crawl-card";
    card.innerHTML = `
      <span>${item.title}</span>
      <strong>${item.label}</strong>
      <p>${item.copy}</p>
    `;
    refs.crawlPanel.append(card);
  });
}

function renderPipeline(stage) {
  refs.pipelineSteps.innerHTML = "";
  const activeIndex = pipeline.findIndex((step) => step.id === stage.pipeline);
  refs.pipelineCaption.textContent = stage.caption;

  pipeline.forEach((step, index) => {
    const card = document.createElement("div");
    card.className = "pipeline-step";
    if (index <= activeIndex) card.classList.add("is-active");
    card.innerHTML = `<strong>${String(index + 1).padStart(2, "0")} · ${step.title}</strong><span>${step.copy}</span>`;
    refs.pipelineSteps.append(card);
  });
}

function renderScenarioTabs() {
  refs.scenarioTabs.innerHTML = "";
  scenarios.forEach((scenario, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scenario-tab";
    if (index === state.scenarioIndex) btn.classList.add("is-active");
    btn.innerHTML = `<strong>${scenario.tabTitle}</strong><span>${scenario.tabCopy}</span>`;
    btn.addEventListener("click", () => {
      stopAutoplay();
      state.scenarioIndex = index;
      state.stageIndex = 0;
      render();
    });
    refs.scenarioTabs.append(btn);
  });
}

function renderStageTabs(scenario) {
  refs.stageTabs.innerHTML = "";
  scenario.stages.forEach((stage, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stage-tab";
    if (index === state.stageIndex) btn.classList.add("is-active");
    btn.innerHTML = `<strong>${String(index + 1).padStart(2, "0")} · ${stage.title}</strong><span>${stage.caption}</span>`;
    btn.addEventListener("click", () => {
      stopAutoplay();
      state.stageIndex = index;
      render();
    });
    refs.stageTabs.append(btn);
  });
}

function render() {
  const scenario = currentScenario();
  const stage = currentStage();

  refs.codeHint.textContent = scenario.codeHint;
  refs.browserHint.textContent = scenario.browserHint;
  refs.analysisHint.textContent = scenario.analysisHint;

  renderScenarioTabs();
  renderStageTabs(scenario);
  renderPipeline(stage);

  renderCode(refs.originalCode, originalCode, stage.originalLines || []);
  renderCode(refs.repairedCode, repairedCode, stage.repairedLines || []);

  refs.v1Label.textContent = pages[stage.v1Page].label;
  refs.v2Label.textContent = pages[stage.v2Page].label;
  renderPage(refs.v1Viewport, stage.v1Page, stage.v1Focus || []);
  renderPage(refs.v2Viewport, stage.v2Page, stage.v2Focus || []);

  renderTemplate(stage);
  renderRepair(stage);
  renderMetrics(stage);
  renderLogs(stage);
  renderCandidates(stage);
  renderCrawl(stage);

  refs.prevStageBtn.disabled = state.scenarioIndex === 0 && state.stageIndex === 0;
  refs.nextStageBtn.disabled =
    state.scenarioIndex === scenarios.length - 1 &&
    state.stageIndex === scenario.stages.length - 1;
  refs.playAllBtn.textContent = state.isAutoplay ? "停止自动播放" : "自动播放完整流程";
}

function autoplay() {
  stopAutoplay();
  state.isAutoplay = true;

  const advance = () => {
    render();
    state.autoplayId = window.setTimeout(() => {
      const hasNext = nextPosition();
      if (hasNext) {
        advance();
      } else {
        stopAutoplay();
        render();
      }
    }, 2200);
  };

  advance();
}

refs.prevStageBtn.addEventListener("click", () => {
  stopAutoplay();
  if (prevPosition()) render();
});

refs.nextStageBtn.addEventListener("click", () => {
  stopAutoplay();
  if (nextPosition()) render();
});

refs.playAllBtn.addEventListener("click", () => {
  if (state.autoplayId) {
    stopAutoplay();
    render();
    return;
  }
  state.scenarioIndex = 0;
  state.stageIndex = 0;
  autoplay();
});

refs.resetBtn.addEventListener("click", () => {
  stopAutoplay();
  state.scenarioIndex = 0;
  state.stageIndex = 0;
  render();
});

render();
