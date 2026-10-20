#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/*
 * 화면 어디서나 오른쪽으로 밀면 뒤로 간다(iOS 26 이상의 기본 동작). 그런데 옆으로 넘기는 영역
 * (이야기 카드, 가게 사진, 칩 줄) 위에서는 스크롤이 손가락을 먼저 가져가서, 첫 장에서 오른쪽으로
 * 밀어도 뒤로 가지 않았다(사용자 결정 2026.10.20: 웹 뒤로 가기처럼 어디서나 되게).
 *
 * 그래서 가로로만 넘기는 스크롤이 이미 맨 앞에 있고, 손가락이 오른쪽으로 움직이고,
 * 뒤에 돌아갈 화면이 있을 때만 그 스크롤의 팬 제스처를 시작하지 않게 한다.
 * 그러면 그 밀기는 내비게이션의 뒤로 가기 제스처가 받는다. 맨 앞에서 오른쪽으로는 어차피
 * 넘길 내용이 없어서(튕김뿐이라) 잃는 것이 없다. 세로 스크롤과 모달(사진 크게 보기)은 건드리지 않는다.
 */

static BOOL RAOTACanGoBackFrom(UIView *view)
{
  UIResponder *responder = view;
  while (responder && ![responder isKindOfClass:[UIViewController class]]) {
    responder = responder.nextResponder;
  }
  // 겹친 스택(그룹 안의 스택)은 안쪽에 한 장뿐이어도 바깥 스택이 돌아갈 수 있다
  UINavigationController *nav = ((UIViewController *)responder).navigationController;
  while (nav) {
    if (nav.viewControllers.count > 1) return YES;
    nav = nav.navigationController;
  }
  return NO;
}

@implementation UIScrollView (RAOTABackSwipe)

+ (void)load
{
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    Class cls = [UIScrollView class];
    SEL original = @selector(gestureRecognizerShouldBegin:);
    SEL replacement = @selector(raota_gestureRecognizerShouldBegin:);
    Method replacementMethod = class_getInstanceMethod(cls, replacement);
    // UIScrollView가 직접 구현하지 않았으면 UIView의 것을 물려받으므로 먼저 자기 자리에 붙인다
    if (class_addMethod(cls, original, method_getImplementation(replacementMethod), method_getTypeEncoding(replacementMethod))) {
      Method inherited = class_getInstanceMethod([UIView class], original);
      class_replaceMethod(cls, replacement, method_getImplementation(inherited), method_getTypeEncoding(inherited));
    } else {
      method_exchangeImplementations(class_getInstanceMethod(cls, original), replacementMethod);
    }
  });
}

- (BOOL)raota_gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer
{
  if (gestureRecognizer == self.panGestureRecognizer && [self raota_yieldsToBackSwipe]) {
    return NO;
  }
  return [self raota_gestureRecognizerShouldBegin:gestureRecognizer];
}

- (BOOL)raota_yieldsToBackSwipe
{
  UIEdgeInsets inset = self.adjustedContentInset;
  CGSize size = self.bounds.size;
  BOOL scrollsSideways = self.contentSize.width + inset.left + inset.right > size.width + 1;
  BOOL scrollsDown = self.contentSize.height + inset.top + inset.bottom > size.height + 1;
  if (!scrollsSideways || scrollsDown) return NO;

  BOOL rtl = [UIView userInterfaceLayoutDirectionForSemanticContentAttribute:self.semanticContentAttribute] ==
      UIUserInterfaceLayoutDirectionRightToLeft;
  if (rtl) return NO;

  BOOL atFirstPage = self.contentOffset.x <= -inset.left + 0.5;
  if (!atFirstPage) return NO;

  CGPoint velocity = [self.panGestureRecognizer velocityInView:self];
  if (velocity.x <= 0 || fabs(velocity.x) <= fabs(velocity.y)) return NO;

  return RAOTACanGoBackFrom(self);
}

@end
