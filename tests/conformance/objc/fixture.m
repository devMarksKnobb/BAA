#import <Foundation/Foundation.h>
@protocol REAWidgetDelegate <NSObject>
- (void)widgetDidFinish;
@end
@interface REAWidget : NSObject
@property(nonatomic, weak) id<REAWidgetDelegate> delegate;
- (BOOL)performAction:(NSString *)action error:(NSError **)error;
@end
@implementation REAWidget
- (BOOL)performAction:(NSString *)action error:(NSError **)error {
  NSLog(@"BAA_OBJC_ACTION:%@", action);
  return action.length > 0;
}
@end
int main(void) {
  @autoreleasepool {
    Protocol *protocol = @protocol(REAWidgetDelegate);
    NSLog(@"%@", NSStringFromProtocol(protocol));
    NSLog(@"BAA_UTF16_é_😀");
    NSLog(@"BAA_UTF16_ESCAPED_é_\"\\line\nend\t\r");
    NSLog(@"\nBAA_UTF16_LEADING_é");
    return [[[REAWidget alloc] init] performAction:@"run" error:0] ? 0 : 1;
  }
}
