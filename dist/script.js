const PAGE_TRANSITION_MAX_MS = 1600;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = window.matchMedia('(max-width: 900px)');
const sectionTabs = [...document.querySelectorAll('.section-tab')];
const sectionPanels = [...document.querySelectorAll('.app > .col')];
const projectThumbs = [...document.querySelectorAll('.thumb')];
const projectItems = [...document.querySelectorAll('.project')];

/* ================= 프로젝트 첫 진입 순차 등장 모션 ================= */
/* 이미지 박스 → 상세 페이지 확장에 사용하는 spring basic: 200 / 30 */
const SPRING_BASIC = Object.freeze({ stiffness: 200, damping: 30, mass: 1 });
/* 이전에 정한 spring slow 값: stiffness 70 / damping 20 */
const SPRING_SLOW = Object.freeze({ stiffness: 70, damping: 20, mass: 1 });
const PROJECT_REVEAL_STAGGER_MS = 100; /* 항목 사이의 순차 등장 간격 */
const PROJECT_REVEAL_OFFSET_PX = 40; /* 프로젝트가 올라오기 시작하는 아래쪽 거리 */

const revealProjectWithSpring = (project, delay) => {
  const { stiffness, damping, mass } = SPRING_SLOW;
  const startsAt = performance.now() + delay;
  let previousTime = startsAt;
  let opacity = 0;
  let velocity = 0;

  const update = (time) => {
    if (time < startsAt) {
      requestAnimationFrame(update);
      return;
    }

    /* 긴 프레임 이후 값이 튀지 않도록 한 프레임의 계산 시간을 제한합니다. */
    const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 0), 1 / 30);
    previousTime = time;

    const springForce = -stiffness * (opacity - 1);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * deltaTime;
    opacity += velocity * deltaTime;
    const progress = Math.min(1, Math.max(0, opacity));
    project.style.opacity = String(progress);
    project.style.transform = `translateY(${(1 - progress) * PROJECT_REVEAL_OFFSET_PX}px)`;

    if (Math.abs(1 - opacity) > 0.001 || Math.abs(velocity) > 0.001) {
      requestAnimationFrame(update);
      return;
    }

    project.style.opacity = '';
    project.style.transform = '';
    project.classList.remove('is-entering');
  };

  requestAnimationFrame(update);
};

if (projectItems.length && !reduceMotion.matches) {
  /* 첫 프레임에는 모든 항목을 투명하게 고정한 뒤 위에서부터 시작합니다. */
  projectItems.forEach((project) => project.classList.add('is-entering'));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      projectItems.forEach((project, index) => {
        revealProjectWithSpring(project, index * PROJECT_REVEAL_STAGGER_MS);
      });
    });
  });
}

const activateSection = (tab) => {
  const panelId = tab.dataset.tab;

  sectionTabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle('is-active', isActive);
    item.setAttribute('aria-selected', String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });

  sectionPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === panelId);
  });

  if (mobileLayout.matches) {
    window.scrollTo(0, 0);
  }
};

sectionTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateSection(tab));

  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;

    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + sectionTabs.length) % sectionTabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % sectionTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = sectionTabs.length - 1;

    sectionTabs[nextIndex].focus();
    activateSection(sectionTabs[nextIndex]);
  });
});

const projectsTab = sectionTabs.find((tab) => tab.dataset.tab === 'projects-panel');

/* 데스크톱에서 태블릿/모바일 크기로 진입할 때마다 Projects를 첫 화면으로 표시 */
mobileLayout.addEventListener('change', (event) => {
  if (event.matches && projectsTab) {
    activateSection(projectsTab);
  }
});

const projectDetailPage = document.querySelector('.project-detail-page');

/* ================= 프로젝트 상세 페이지 등장 모션 ================= */
if (projectDetailPage) {
  /* project.html에서 case-reveal 클래스가 붙은 모든 본문 섹션 */
  const revealSections = [...document.querySelectorAll('.case-reveal')];

  /* 메인 화면의 확장 전환이 끝나고 상세 페이지가 로드된 다음 콘텐츠 표시 */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => projectDetailPage.classList.add('is-ready'));
  });

  /* 각 본문 섹션이 화면 안으로 들어오면 is-visible 클래스를 붙입니다. */
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08 });

    /* 위 threshold 숫자를 키우면 섹션이 더 많이 보인 뒤 등장합니다. */
    revealSections.forEach((section) => revealObserver.observe(section));
  } else {
    /* 모션 감소 설정 또는 구형 브라우저에서는 즉시 표시 */
    revealSections.forEach((section) => section.classList.add('is-visible'));
  }
}

const compileRippleShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

/* 박스는 고정하고, WebGL의 연속 UV 좌표에서 내부 이미지만 부드럽게 일렁임 */
const playContentRipple = (thumb, event, onComplete) => {
  const image = thumb.querySelector('img');

  if (!image || !image.complete || !image.naturalWidth) {
    onComplete();
    return;
  }

  const rect = thumb.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const clickX = event.detail === 0 ? width / 2 : event.clientX - rect.left;
  const clickY = event.detail === 0 ? height / 2 : event.clientY - rect.top;
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    onComplete();
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;

    uniform sampler2D u_texture;
    uniform vec2 u_center;
    uniform vec2 u_uv_scale;
    uniform vec2 u_uv_offset;
    uniform float u_aspect;
    uniform float u_progress;
    varying vec2 v_uv;

    void main() {
      vec2 delta = v_uv - u_center;
      delta.x *= u_aspect;
      float distanceFromClick = length(delta);
      vec2 direction = distanceFromClick > 0.0001 ? delta / distanceFromClick : vec2(0.0);
      direction.x /= u_aspect;

      float waveFront = u_progress * 1.5;
      float distanceToWave = distanceFromClick - waveFront;
      float waveBand = exp(-pow(distanceToWave * 12.0, 2.0));
      float oscillation = sin(distanceToWave * 42.0);
      float remaining = 1.0 - u_progress;
      vec2 displacement = direction * oscillation * waveBand * remaining * 0.014;
      vec2 displacedUv = clamp(v_uv + displacement, 0.0, 1.0);
      vec2 textureUv = u_uv_offset + (displacedUv * u_uv_scale);
      vec4 color = texture2D(u_texture, textureUv);

      float whiteLight = waveBand * remaining * 0.08;
      color.rgb = 1.0 - ((1.0 - color.rgb) * (1.0 - whiteLight));
      gl_FragColor = color;
    }
  `;
  const vertexShader = compileRippleShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileRippleShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    onComplete();
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    onComplete();
    return;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    onComplete();
    return;
  }

  canvas.className = 'thumb-content-ripple-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  thumb.classList.add('is-content-rippling');
  thumb.append(canvas);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } catch (error) {
    canvas.remove();
    thumb.classList.remove('is-content-rippling');
    onComplete();
    return;
  }

  const destinationAspect = width / height;
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  let uvScaleX = 1;
  let uvScaleY = 1;
  let uvOffsetX = 0;
  let uvOffsetY = 0;

  /* CSS object-fit: cover와 같은 범위를 텍스처에서 샘플링 */
  if (sourceAspect > destinationAspect) {
    uvScaleX = destinationAspect / sourceAspect;
    uvOffsetX = (1 - uvScaleX) / 2;
  } else {
    uvScaleY = sourceAspect / destinationAspect;
    uvOffsetY = (1 - uvScaleY) / 2;
  }

  gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
  gl.uniform2f(
    gl.getUniformLocation(program, 'u_center'),
    Math.min(1, Math.max(0, clickX / width)),
    1 - Math.min(1, Math.max(0, clickY / height)),
  );
  gl.uniform2f(gl.getUniformLocation(program, 'u_uv_scale'), uvScaleX, uvScaleY);
  gl.uniform2f(gl.getUniformLocation(program, 'u_uv_offset'), uvOffsetX, uvOffsetY);
  gl.uniform1f(gl.getUniformLocation(program, 'u_aspect'), width / height);

  const progressLocation = gl.getUniformLocation(program, 'u_progress');
  const duration = 720;
  const startedAt = performance.now();

  const finish = () => {
    canvas.remove();
    thumb.classList.remove('is-content-rippling');
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    onComplete();
  };

  const drawFrame = (time) => {
    const progress = Math.min((time - startedAt) / duration, 1);
    gl.uniform1f(progressLocation, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (progress < 1) {
      requestAnimationFrame(drawFrame);
    } else {
      finish();
    }
  };

  /* 클릭 순간 첫 frame을 즉시 렌더링 */
  drawFrame(startedAt);
};

const startProjectPageTransition = (thumb) => {
  const destination = thumb.href;
  const rect = thumb.getBoundingClientRect();
  const transitionLayer = document.createElement('div');
  const sourceImage = thumb.querySelector('img');
  const clonedImage = sourceImage ? sourceImage.cloneNode(true) : null;
  const transitionDim = clonedImage ? document.createElement('div') : null;
  const startingArea = Math.max(rect.width * rect.height, 1);
  const startingRadius = Number.parseFloat(getComputedStyle(thumb).borderRadius) || 0;
  const targetWidth = window.innerWidth;
  const targetHeight = window.innerHeight;
  let hasNavigated = false;

  transitionLayer.className = 'page-transition';
  transitionLayer.setAttribute('aria-hidden', 'true');
  transitionLayer.style.top = `${rect.top}px`;
  transitionLayer.style.left = `${rect.left}px`;
  transitionLayer.style.width = `${rect.width}px`;
  transitionLayer.style.height = `${rect.height}px`;
  transitionLayer.style.borderRadius = getComputedStyle(thumb).borderRadius;
  transitionLayer.style.backgroundColor = getComputedStyle(thumb).backgroundColor;

  if (clonedImage) {
    transitionLayer.append(clonedImage);
    transitionDim.className = 'page-transition-dim';
    transitionLayer.append(transitionDim);
  }

  document.body.append(transitionLayer);

  const navigate = () => {
    if (hasNavigated) return;
    hasNavigated = true;
    window.location.href = destination;
  };

  /* CSS transition 대신 spring basic 물리값으로 박스의 위치와 크기를 계산합니다. */
  const { stiffness, damping, mass } = SPRING_BASIC;
  const startedAt = performance.now();
  let previousTime = startedAt;
  let progress = 0;
  let velocity = 0;

  const renderPageTransition = (time) => {
    const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 0), 1 / 30);
    previousTime = time;

    const springForce = -stiffness * (progress - 1);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * deltaTime;
    progress += velocity * deltaTime;

    const visibleProgress = Math.min(1, Math.max(0, progress));
    const currentTop = rect.top * (1 - visibleProgress);
    const currentLeft = rect.left * (1 - visibleProgress);
    const currentWidth = rect.width + ((targetWidth - rect.width) * visibleProgress);
    const currentHeight = rect.height + ((targetHeight - rect.height) * visibleProgress);
    const currentRadius = startingRadius * (1 - visibleProgress);

    transitionLayer.style.top = `${currentTop}px`;
    transitionLayer.style.left = `${currentLeft}px`;
    transitionLayer.style.width = `${currentWidth}px`;
    transitionLayer.style.height = `${currentHeight}px`;
    transitionLayer.style.borderRadius = `${currentRadius}px`;

    /* 박스 면적이 시작 크기의 2배가 되는 순간 이미지가 완전히 사라집니다. */
    if (clonedImage) {
      const areaRatio = (currentWidth * currentHeight) / startingArea;
      const imageOpacity = Math.max(0, Math.min(1, 2 - areaRatio));
      clonedImage.style.opacity = `${imageOpacity}`;
      transitionDim.style.opacity = imageOpacity > 0 ? '1' : '0';
    }

    const isSettled = Math.abs(1 - progress) <= 0.001 && Math.abs(velocity) <= 0.001;
    const timedOut = time - startedAt >= PAGE_TRANSITION_MAX_MS;

    if (!isSettled && !timedOut) {
      requestAnimationFrame(renderPageTransition);
      return;
    }

    transitionLayer.style.top = '0';
    transitionLayer.style.left = '0';
    transitionLayer.style.width = `${targetWidth}px`;
    transitionLayer.style.height = `${targetHeight}px`;
    transitionLayer.style.borderRadius = '0';
    transitionLayer.style.backgroundColor = '#ffffff';
    navigate();
  };

  requestAnimationFrame(renderPageTransition);
  window.setTimeout(navigate, PAGE_TRANSITION_MAX_MS + 100);
};

projectThumbs.forEach((thumb) => {
  thumb.addEventListener('click', (event) => {
    const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (isModifiedClick || event.button !== 0 || reduceMotion.matches) return;

    event.preventDefault();

    if (document.querySelector('.page-transition')
      || document.querySelector('.thumb.is-content-rippling')) return;

    playContentRipple(thumb, event, () => startProjectPageTransition(thumb));
  });
});

const backButton = document.querySelector('.back-button');

if (backButton) {
  backButton.addEventListener('click', (event) => {
    const cameFromMainPage = document.referrer.startsWith(window.location.origin)
      && document.referrer.includes('index.html');

    if (cameFromMainPage) {
      event.preventDefault();
      window.history.back();
    }
  });
}
